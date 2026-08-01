import type { TechnicalDocumentInput } from "@/lib/hvac/document-validation";
import {
  DuplicateTechnicalDocumentError,
  TechnicalCatalogError,
  UploadReconciliationRequiredError,
} from "@/lib/hvac/errors";

interface AssociationEntity {
  id: string;
  active: boolean;
}

export interface DocumentAssociationLookup {
  findEquipment(ids: string[]): Promise<AssociationEntity[]>;
  findSystemCombinations(ids: string[]): Promise<AssociationEntity[]>;
}

export interface DocumentAssociationValidationOptions {
  currentEquipmentIds?: string[];
  currentSystemCombinationIds?: string[];
}

function assertAssociations(
  requestedIds: string[],
  found: AssociationEntity[],
  entityLabel: string,
  currentIds: string[],
) {
  const foundById = new Map(found.map((entity) => [entity.id, entity]));
  for (const id of requestedIds) {
    const entity = foundById.get(id);
    if (!entity) {
      throw new TechnicalCatalogError(
        `${entityLabel} sélectionné n’existe plus.`,
        "INVALID_ASSOCIATION",
      );
    }
    if (!entity.active && !currentIds.includes(id)) {
      throw new TechnicalCatalogError(
        `${entityLabel} sélectionné est inactif et ne peut pas être ajouté.`,
        "INVALID_ASSOCIATION",
      );
    }
  }
}

export async function validateDocumentAssociations(
  lookup: DocumentAssociationLookup,
  input: Pick<
    TechnicalDocumentInput,
    "equipmentIds" | "systemCombinationIds"
  >,
  options: DocumentAssociationValidationOptions = {},
) {
  const [equipment, systemCombinations] = await Promise.all([
    lookup.findEquipment(input.equipmentIds),
    lookup.findSystemCombinations(input.systemCombinationIds),
  ]);
  assertAssociations(
    input.equipmentIds,
    equipment,
    "L’équipement",
    options.currentEquipmentIds ?? [],
  );
  assertAssociations(
    input.systemCombinationIds,
    systemCombinations,
    "La combinaison",
    options.currentSystemCombinationIds ?? [],
  );
  return {
    equipmentIds: input.equipmentIds,
    systemCombinationIds: input.systemCombinationIds,
  };
}

export function technicalDocumentMetadata(input: TechnicalDocumentInput) {
  return {
    title: input.title,
    type: input.type,
    version: input.version,
    documentDate: input.documentDate,
    isPrimary: input.isPrimary,
    active: input.active,
  };
}

export function technicalDocumentStatusData(active: boolean) {
  return { active };
}

export interface DocumentChecksumLookup {
  findByChecksum(checksumSha256: string): Promise<{ id: string } | null>;
}

export async function assertUniqueDocumentChecksum(
  lookup: DocumentChecksumLookup,
  checksumSha256: string,
) {
  const duplicate = await lookup.findByChecksum(checksumSha256);
  if (duplicate) throw new DuplicateTechnicalDocumentError(duplicate.id);
}

export interface UploadCompensationDependencies<T extends { id: string }> {
  write(): Promise<void>;
  persist(): Promise<T>;
  lookupPersisted(): Promise<T | null>;
  remove(): Promise<void>;
  record(result: {
    databaseCheck:
      | "NOT_ATTEMPTED"
      | "COMMIT_CONFIRMED"
      | "ROLLBACK_CONFIRMED"
      | "REFERENCE_FOUND"
      | "REFERENCE_NOT_FOUND"
      | "CHECK_FAILED";
    reconciliationState:
      | "PENDING_DB"
      | "COMMITTED"
      | "ROLLED_BACK"
      | "AMBIGUOUS";
    ambiguityReason: string | null;
  }): Promise<void>;
}

function errorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return null;
  return typeof error.code === "string" ? error.code : null;
}

export function isAmbiguousPersistenceError(error: unknown) {
  if (error instanceof TechnicalCatalogError) return false;
  return !["P2002", "P2003", "P2025", "P2034"].includes(
    errorCode(error) ?? "",
  );
}

export async function persistUploadedDocument<T extends { id: string }>(
  dependencies: UploadCompensationDependencies<T>,
) {
  await dependencies.write();
  try {
    await dependencies.record({
      databaseCheck: "NOT_ATTEMPTED",
      reconciliationState: "PENDING_DB",
      ambiguityReason: null,
    });
  } catch (error) {
    try {
      await dependencies.remove();
    } catch {
      throw new UploadReconciliationRequiredError();
    }
    throw error;
  }

  let persistedResult: T;
  try {
    persistedResult = await dependencies.persist();
  } catch (error) {
    let persisted: T | null;
    try {
      persisted = await dependencies.lookupPersisted();
    } catch (lookupError) {
      await dependencies.record({
        databaseCheck: "CHECK_FAILED",
        reconciliationState: "AMBIGUOUS",
        ambiguityReason: lookupError instanceof Error
          ? lookupError.message.slice(0, 500)
          : "Database verification failed.",
      }).catch(() => undefined);
      throw new UploadReconciliationRequiredError();
    }
    if (persisted) {
      await dependencies.record({
        databaseCheck: "REFERENCE_FOUND",
        reconciliationState: "COMMITTED",
        ambiguityReason: null,
      }).catch(() => {
        throw new UploadReconciliationRequiredError();
      });
      return persisted;
    }
    if (isAmbiguousPersistenceError(error)) {
      await dependencies.record({
        databaseCheck: "REFERENCE_NOT_FOUND",
        reconciliationState: "AMBIGUOUS",
        ambiguityReason: error instanceof Error
          ? error.message.slice(0, 500)
          : "Database result is ambiguous.",
      }).catch(() => undefined);
      throw new UploadReconciliationRequiredError();
    }
    try {
      await dependencies.remove();
    } catch (removeError) {
      await dependencies.record({
        databaseCheck: "ROLLBACK_CONFIRMED",
        reconciliationState: "AMBIGUOUS",
        ambiguityReason: removeError instanceof Error
          ? `Rollback confirmed but file compensation failed: ${
              removeError.message.slice(0, 400)
            }`
          : "Rollback confirmed but file compensation failed.",
      }).catch(() => undefined);
      throw new UploadReconciliationRequiredError();
    }
    await dependencies.record({
      databaseCheck: "ROLLBACK_CONFIRMED",
      reconciliationState: "ROLLED_BACK",
      ambiguityReason: null,
    }).catch(() => undefined);
    throw error;
  }
  try {
    await dependencies.record({
      databaseCheck: "COMMIT_CONFIRMED",
      reconciliationState: "COMMITTED",
      ambiguityReason: null,
    });
  } catch {
    throw new UploadReconciliationRequiredError();
  }
  return persistedResult;
}
