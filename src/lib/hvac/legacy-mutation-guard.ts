import "server-only";

import { getSession } from "@/lib/auth/session";
import {
  legacyMutationRejectedError,
  type LegacyMutationAttempt,
} from "@/lib/hvac/legacy-read-only";
import {
  recordLegacyMutationRejection,
} from "@/lib/hvac/legacy-audit-service";
import { prisma } from "@/lib/prisma";

export async function rejectLegacyCatalogMutation(
  attempt: LegacyMutationAttempt,
  message?: string,
): Promise<never> {
  const session = await getSession();
  await recordLegacyMutationRejection({
    findCurrentUser(id) {
      return prisma.user.findUnique({
        where: { id },
        select: { id: true, role: true, active: true },
      });
    },
    async createAudit(data) {
      await prisma.auditLog.create({
        data,
      });
    },
  }, attempt, session?.id ?? null);
  const error = legacyMutationRejectedError();
  if (message) error.message = message;
  throw error;
}
