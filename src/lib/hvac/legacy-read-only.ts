import type { UserRole } from "@/generated/prisma/enums";
import { TechnicalCatalogError } from "@/lib/hvac/errors";

export const LEGACY_CATALOG_READ_ONLY_MESSAGE =
  "Le catalogue PAC historique est en lecture seule. Utilisez la nouvelle bibliothèque technique pour toute administration.";

export interface LegacyMutationAttempt {
  operation: string;
  entityType: "HeatPump" | "PacDocument" | "PacBrand" | "Refrigerant";
  entityId?: string;
}

export function legacyMutationRejectedError() {
  return new TechnicalCatalogError(
    LEGACY_CATALOG_READ_ONLY_MESSAGE,
    "LEGACY_READ_ONLY",
  );
}

export function legacyMutationAuditMetadata(
  attempt: LegacyMutationAttempt,
  actor: {
    sessionUserId: string | null;
    currentRole: UserRole | null;
    active: boolean | null;
  },
) {
  return {
    operation: attempt.operation.slice(0, 80),
    entityType: attempt.entityType,
    entityId: attempt.entityId?.slice(0, 160) ?? null,
    reason: "LEGACY_CATALOG_READ_ONLY",
    actor: {
      sessionUserId: actor.sessionUserId,
      currentRole: actor.currentRole,
      active: actor.active,
    },
  };
}
