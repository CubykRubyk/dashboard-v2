import type { UserRole } from "@/generated/prisma/enums";
import {
  legacyMutationAuditMetadata,
  type LegacyMutationAttempt,
} from "@/lib/hvac/legacy-read-only";

export interface LegacyRejectionAuditStore {
  findCurrentUser(id: string): Promise<{
    id: string;
    role: UserRole;
    active: boolean;
  } | null>;
  createAudit(data: {
    userId: string | null;
    action: "HVAC_LEGACY_MUTATION_REJECTED";
    entityType: LegacyMutationAttempt["entityType"];
    entityId: string | null;
    metadata: ReturnType<typeof legacyMutationAuditMetadata>;
  }): Promise<void>;
}

export async function recordLegacyMutationRejection(
  store: LegacyRejectionAuditStore,
  attempt: LegacyMutationAttempt,
  sessionUserId: string | null,
) {
  const current = sessionUserId
    ? await store.findCurrentUser(sessionUserId)
    : null;
  const metadata = legacyMutationAuditMetadata(attempt, {
    sessionUserId,
    currentRole: current?.role ?? null,
    active: current?.active ?? null,
  });
  await store.createAudit({
    userId: current?.id ?? null,
    action: "HVAC_LEGACY_MUTATION_REJECTED",
    entityType: attempt.entityType,
    entityId: attempt.entityId?.slice(0, 160) ?? null,
    metadata,
  });
  return metadata;
}
