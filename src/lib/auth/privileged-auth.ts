import type { UserRole } from "@/generated/prisma/enums";
import { TechnicalCatalogError } from "@/lib/hvac/errors";

export interface PrivilegedSession {
  id: string;
  role: UserRole;
}

export interface CurrentUserLookup {
  findCurrentUser(id: string): Promise<{
    id: string;
    email: string;
    name: string;
    role: UserRole;
    active: boolean;
  } | null>;
}

export async function authorizeCurrentTechnicalCatalogAdmin(
  session: PrivilegedSession | null,
  lookup: CurrentUserLookup,
) {
  if (!session) {
    throw new TechnicalCatalogError(
      "Votre session n’est plus valide. Reconnectez-vous.",
      "UNAUTHORIZED",
    );
  }
  const current = await lookup.findCurrentUser(session.id);
  if (!current || !current.active) {
    throw new TechnicalCatalogError(
      "Votre compte est supprimé ou désactivé. Aucune modification n’a été effectuée.",
      "UNAUTHORIZED",
    );
  }
  if (current.role !== "ADMIN") {
    throw new TechnicalCatalogError(
      "Vos droits administrateur ne sont plus actifs. Aucune modification n’a été effectuée.",
      "UNAUTHORIZED",
    );
  }
  return current;
}
