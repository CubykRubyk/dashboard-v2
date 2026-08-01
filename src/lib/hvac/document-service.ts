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
    return await dependencies.persist();
  } catch (error) {
    let persisted: T | null;
    try {
      persisted = await dependencies.lookupPersisted();
    } catch {
      throw new UploadReconciliationRequiredError();
    }
    if (persisted) return persisted;
    if (isAmbiguousPersistenceError(error)) {
      throw new UploadReconciliationRequiredError();
    }
    try {
      await dependencies.remove();
    } catch {
      throw new UploadReconciliationRequiredError();
    }
    throw error;
  }
}
