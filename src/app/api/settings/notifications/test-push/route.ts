import { NextResponse } from "next/server";

import { canManageNotifications } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/session";
import { pushToUser } from "@/lib/notifications/push";
import { prisma } from "@/lib/prisma";
import { getPushConfig } from "@/lib/settings/runtime-config";

/**
 * Notification push de test vers les appareils de l'administrateur connecté.
 *
 * Le compte rendu distingue les trois situations qu'on confond facilement : pas de clés, pas
 * d'appareil abonné, ou envoi qui échoue. Sans cette distinction, « je ne reçois rien » est
 * indiagnosticable à distance.
 */
export async function POST() {
  const user = await getSession();
  if (!canManageNotifications(user?.role)) {
    return NextResponse.json({ error: "Droits administrateur requis." }, { status: 403 });
  }

  if (!(await getPushConfig())) {
    return NextResponse.json(
      { error: "Les clés push ne sont pas configurées. Générez-les d’abord." },
      { status: 409 },
    );
  }

  const devices = await prisma.pushSubscription.count({ where: { userId: user!.id } });
  if (devices === 0) {
    return NextResponse.json(
      {
        error:
          "Aucun appareil abonné pour votre compte. Sur le téléphone : installez l’application "
          + "sur l’écran d’accueil, puis Profil → « Activer les notifications ».",
      },
      { status: 409 },
    );
  }

  const result = await pushToUser(user!.id, {
    title: "Notification de test",
    body: `Envoyée depuis les paramètres le ${new Date().toLocaleString("fr-FR")}`,
    url: "/mobile",
    tag: "test-notification",
  });

  if (result.sent === 0) {
    return NextResponse.json(
      {
        error:
          result.removed > 0
            ? `Aucun envoi abouti : ${result.removed} abonnement(s) étaient périmés et ont été supprimés. `
              + "Réactivez les notifications sur le téléphone."
            : "L’envoi a échoué. Vérifiez les clés push et consultez les journaux du serveur.",
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    message:
      `Notification envoyée à ${result.sent} appareil${result.sent > 1 ? "s" : ""}.`
      + (result.removed > 0 ? ` ${result.removed} abonnement(s) périmé(s) supprimé(s).` : ""),
  });
}
