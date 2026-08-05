import { NextResponse } from "next/server";
import webpush from "web-push";

import { canManageNotifications } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/session";
import { encryptSecret } from "@/lib/dolibarr/crypto";
import { prisma } from "@/lib/prisma";
import { invalidateRuntimeConfig } from "@/lib/settings/runtime-config";

/**
 * Génère une nouvelle paire de clés VAPID et l'enregistre.
 *
 * **Opération à conséquence** : les clés VAPID ne sont pas un simple secret que l'on ferait
 * tourner sans dommage — elles constituent l'identité de l'expéditeur auprès des services de push.
 * En changer invalide **tous les abonnements existants** : chaque téléphone devra réactiver les
 * notifications. C'est pourquoi les abonnements devenus caducs sont supprimés dans la foulée
 * (les garder ne ferait qu'accumuler des échecs d'envoi) et que le nombre d'appareils concernés
 * est renvoyé, pour que l'interface puisse le dire clairement.
 */
export async function POST() {
  const user = await getSession();
  if (!canManageNotifications(user?.role)) {
    return NextResponse.json({ error: "Droits administrateur requis." }, { status: 403 });
  }

  const keys = webpush.generateVAPIDKeys();

  const [, , removed] = await prisma.$transaction([
    prisma.appSettings.upsert({
      where: { id: 1 },
      update: {
        vapidPublicKey: keys.publicKey,
        vapidPrivateKeyEncrypted: encryptSecret(keys.privateKey),
      },
      create: {
        id: 1,
        vapidPublicKey: keys.publicKey,
        vapidPrivateKeyEncrypted: encryptSecret(keys.privateKey),
      },
    }),
    prisma.auditLog.create({
      data: {
        userId: user!.id,
        action: "NOTIFICATION_VAPID_REGENERATE",
        entityType: "AppSettings",
        entityId: "1",
      },
    }),
    // Les anciens abonnements ne peuvent plus recevoir : ils sont signés avec la clé précédente.
    prisma.pushSubscription.deleteMany({}),
  ]);
  invalidateRuntimeConfig();

  return NextResponse.json({
    ok: true,
    publicKey: keys.publicKey,
    devicesDisconnected: removed.count,
  });
}
