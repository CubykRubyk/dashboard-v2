import "server-only";

import { getSession } from "@/lib/auth/session";
import { canManageTechnicalCatalog } from "@/lib/auth/permissions";

export async function requireTechnicalCatalogAdmin() {
  const user = await getSession();
  if (!user || !canManageTechnicalCatalog(user.role)) {
    throw new Error("Accès non autorisé.");
  }
  return user;
}
