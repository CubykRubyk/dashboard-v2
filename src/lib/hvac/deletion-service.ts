import { TechnicalCatalogError } from "@/lib/hvac/errors";

export interface EquipmentDeletionBlocker {
  id: string;
  name: string;
  indoorReference: string;
  outdoorReference: string;
}

export class EquipmentDeletionBlockedError extends TechnicalCatalogError {
  constructor(public readonly blockers: EquipmentDeletionBlocker[]) {
    super(
      `Cet équipement est encore utilisé par ${
        blockers.length
      } combinaison(s) : ${blockers.map((item) => item.name).join(", ")}. Supprimez d’abord ces combinaisons.`,
      "DEPENDENCY_CONFLICT",
    );
    this.name = "EquipmentDeletionBlockedError";
  }
}

export function assertDeletionConfirmation(
  submittedConfirmation: string,
  expectedConfirmation: string,
) {
  if (submittedConfirmation.trim() !== expectedConfirmation) {
    throw new TechnicalCatalogError(
      "La confirmation ne correspond pas à l’entité à supprimer.",
      "CONFIRMATION_REQUIRED",
    );
  }
}

export function assertEquipmentDeletionAllowed(
  blockers: EquipmentDeletionBlocker[],
) {
  if (blockers.length > 0) {
    throw new EquipmentDeletionBlockedError(blockers);
  }
}

export function activeAssociatedDocuments<T extends { active: boolean }>(
  documents: T[],
) {
  return documents.filter((document) => document.active);
}
