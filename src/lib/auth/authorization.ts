import "server-only";

import { getSession } from "@/lib/auth/session";
import {
  authorizeCurrentTechnicalCatalogAdmin,
} from "@/lib/auth/privileged-auth";
import { prisma } from "@/lib/prisma";

export async function requireTechnicalCatalogAdmin() {
  const session = await getSession();
  return authorizeCurrentTechnicalCatalogAdmin(session, {
    findCurrentUser(id) {
      return prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          active: true,
        },
      });
    },
  });
}
