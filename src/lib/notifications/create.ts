import "server-only";

import { prisma } from "@/lib/prisma";

import { pushToUser } from "./push";

export type NotificationType =
  | "SAV_CREATED"
  | "WORKSHEET_SUBMITTED"
  | "INTERVENTION_ASSIGNED";

export interface NotificationInput {
  type: NotificationType;
  title: string;
  body?: string;
  entityType?: string;
  entityId?: string;
}

/**
 * Crée une notification pour un utilisateur. **Ne lève jamais** : une notification perdue ne doit
 * pas faire échouer l'action métier qui l'a déclenchée (création de SAV, envoi de fiche…). Le
 * ticket est bien plus important que l'alerte qui l'accompagne.
 */
export async function notifyUser(userId: string, input: NotificationInput) {
  const created = await prisma.notification
    .create({
      data: {
        userId,
        type: input.type,
        title: input.title,
        body: input.body ?? "",
        entityType: input.entityType,
        entityId: input.entityId,
      },
      select: { id: true },
    })
    .catch(() => null);

  // Push en plus de l'enregistrement : la notification doit atteindre l'utilisateur même
  // application fermée. `pushToUser` ne lève pas non plus, et ne fait rien si VAPID n'est pas
  // configuré.
  await pushToUser(userId, {
    title: input.title,
    body: input.body ?? "",
    url: notificationHref(input),
    // Regroupe les rappels concernant la même entité plutôt que d'empiler des doublons.
    tag: input.entityId ? `${input.entityType}-${input.entityId}` : undefined,
  }).catch(() => undefined);

  return created;
}

/** Lien de rebond ouvert au clic sur la notification système. */
function notificationHref(input: NotificationInput) {
  if (input.entityType === "SavTicket" && input.entityId) {
    return `/planification-sav/${input.entityId}`;
  }
  if (input.entityType === "InterventionPlanning" && input.entityId) {
    return `/mobile/item/${input.entityId}`;
  }
  if (input.entityType === "WorkSheet" && input.entityId) return `/fiches/${input.entityId}`;
  return "/mobile";
}

/** Notifie tous les administrateurs actifs — utilisé quand l'événement n'a pas de destinataire précis. */
export async function notifyAdmins(input: NotificationInput) {
  const admins = await prisma.user
    .findMany({ where: { role: "ADMIN", active: true }, select: { id: true } })
    .catch(() => [] as { id: string }[]);
  await Promise.all(admins.map((admin) => notifyUser(admin.id, input)));
  return admins.length;
}
