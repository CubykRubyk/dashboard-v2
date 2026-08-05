import "server-only";

import { canViewOwnWorkOnly } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

/**
 * Périmètre de données de l'utilisateur mobile courant.
 *
 * `ownWorkOnly` distingue un technicien (qui ne voit que ses propres interventions et chantiers)
 * des comptes d'administration, qui voient tout. `dolibarrUserId` doit être lu en base : la
 * session est un JWT qui ne porte que id/email/nom/rôle.
 */
export interface MobileScope {
  userId: string;
  ownWorkOnly: boolean;
  /**
   * `null` sur un compte technicien signifie que le rattachement Dolibarr n'a pas été renseigné :
   * on ne peut alors identifier aucune intervention comme étant la sienne. L'interface doit le
   * dire explicitement plutôt que d'afficher une liste vide qui ressemble à « rien de prévu ».
   */
  dolibarrUserId: string | null;
}

export async function getMobileScope(): Promise<MobileScope | null> {
  const session = await getSession();
  if (!session) return null;

  const ownWorkOnly = canViewOwnWorkOnly(session.role);
  if (!ownWorkOnly) {
    return { userId: session.id, ownWorkOnly: false, dolibarrUserId: null };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { dolibarrUserId: true },
  });
  return {
    userId: session.id,
    ownWorkOnly: true,
    dolibarrUserId: user?.dolibarrUserId ?? null,
  };
}

/** Vrai quand le compte est un technicien sans rattachement Dolibarr exploitable. */
export function isUnlinkedTechnician(scope: MobileScope | null) {
  return Boolean(scope?.ownWorkOnly && !scope.dolibarrUserId);
}
