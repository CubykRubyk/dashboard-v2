import { NextResponse } from "next/server";

import { canManageNotifications } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/session";
import { getDolibarrConfig } from "@/lib/dolibarr/client";
import { recordDirectoryError, syncDolibarrDirectory } from "@/lib/dolibarr/directory";
import { prisma } from "@/lib/prisma";

/**
 * Lance l'import du répertoire Dolibarr (utilisateurs + sociétés clientes).
 *
 * Opération **en lecture seule côté Dolibarr** : deux `GET`, aucune donnée n'y est modifiée.
 * Réservée aux administrateurs, comme le reste de la configuration.
 */
export async function POST() {
  const user = await getSession();
  if (!canManageNotifications(user?.role)) {
    return NextResponse.json({ error: "Droits administrateur requis." }, { status: 403 });
  }

  const config = await getDolibarrConfig();
  if (!config) {
    return NextResponse.json({ error: "Dolibarr n’est pas configuré." }, { status: 409 });
  }

  try {
    const result = await syncDolibarrDirectory(config);
    await prisma.auditLog
      .create({
        data: {
          userId: user!.id,
          action: "DOLIBARR_DIRECTORY_IMPORT",
          entityType: "AppSettings",
          entityId: "1",
          metadata: { ...result },
        },
      })
      .catch(() => undefined);

    return NextResponse.json({
      ok: true,
      ...result,
      message:
        `${result.users.imported} utilisateur(s) et ${result.companies.imported} société(s) importés.`
        + (result.users.deactivated + result.companies.deactivated > 0
          ? ` ${result.users.deactivated + result.companies.deactivated} entrée(s) désactivée(s) (absentes de Dolibarr).`
          : ""),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import impossible.";
    await recordDirectoryError(message);
    return NextResponse.json({ error: `Import échoué : ${message}` }, { status: 502 });
  }
}
