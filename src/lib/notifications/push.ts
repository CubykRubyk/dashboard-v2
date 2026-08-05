import "server-only";

import webpush from "web-push";

import { prisma } from "@/lib/prisma";
import { getPushConfig } from "@/lib/settings/runtime-config";

/**
 * Envoi Web Push. Les clés VAPID identifient l'expéditeur auprès des services de push des
 * navigateurs ; elles se configurent depuis Paramètres → Notifications et vivent en base
 * (`lib/settings/runtime-config.ts`).
 *
 * Sans clés configurées, rien n'est envoyé et l'application fonctionne normalement — même parti
 * pris que pour l'e-mail (`lib/email/send.ts`) : une fonctionnalité de confort ne doit jamais
 * empêcher le travail.
 *
 * Rappel iOS : les notifications push exigent une PWA **installée sur l'écran d'accueil**
 * (iOS 16.4+). Dans un onglet Safari ordinaire, l'abonnement est tout simplement impossible.
 */

/**
 * `setVapidDetails` est appelé **à chaque envoi**, à partir de la configuration lue en base (elle
 * même mise en cache 30 s). Le faire une seule fois au démarrage empêcherait toute clé modifiée
 * depuis les Paramètres d'être prise en compte avant un redémarrage — exactement le scénario du
 * bouton « Générer de nouvelles clés ».
 */
async function applyVapid() {
  const config = await getPushConfig();
  if (!config) return null;
  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
  return config;
}

export async function isPushConfigured() {
  return (await getPushConfig()) !== null;
}

export interface PushPayload {
  title: string;
  body?: string;
  url?: string;
  tag?: string;
}

/**
 * Pousse une notification vers tous les appareils d'un utilisateur.
 *
 * Les abonnements devenus invalides (404/410 : appareil réinitialisé, application désinstallée,
 * abonnement expiré) sont supprimés au passage — sans ce nettoyage, la table accumule des
 * destinations mortes qu'on réessaie indéfiniment.
 */
export async function pushToUser(userId: string, payload: PushPayload) {
  if (!(await applyVapid())) {
    console.info(
      `[push] non configuré (Paramètres → Notifications) — « ${payload.title} » non envoyé à ${userId}`,
    );
    return { sent: 0, removed: 0 };
  }

  const subscriptions = await prisma.pushSubscription
    .findMany({ where: { userId } })
    .catch(() => []);
  if (subscriptions.length === 0) return { sent: 0, removed: 0 };

  const body = JSON.stringify(payload);
  let sent = 0;
  const stale: string[] = [];

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          body,
        );
        sent += 1;
      } catch (error) {
        const status = (error as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) stale.push(subscription.id);
        else console.error("[push] envoi échoué :", status ?? error);
      }
    }),
  );

  if (stale.length > 0) {
    await prisma.pushSubscription
      .deleteMany({ where: { id: { in: stale } } })
      .catch(() => undefined);
  }
  return { sent, removed: stale.length };
}
