import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { canEditDolibarrIntervention } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/session";
import { getDolibarrConfig } from "@/lib/dolibarr/client";
import { updateDolibarrEvent } from "@/lib/dolibarr/event-update";
import { serializeIntervention } from "@/lib/dolibarr/interventions";
import { geocodeAddress } from "@/lib/geo/geocode";
import { notifyUser } from "@/lib/notifications/create";
import { prisma } from "@/lib/prisma";

/**
 * Modification d'une intervention **et écriture dans Dolibarr**.
 *
 * Dolibarr était historiquement en lecture seule ici ; Ion a explicitement levé la règle (« acum
 * o să avem nevoie să edităm fișele Dolibarr »). Réservé aux administrateurs : l'écriture est
 * irréversible côté Dolibarr, contrairement à tout le reste du module.
 */
const patchSchema = z
  .object({
    // "YYYY-MM-DDTHH:mm" — heure de Paris telle que saisie, sans fuseau (voir plus bas).
    startAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/).nullable(),
    endAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/).nullable(),
    title: z.string().trim().min(1).max(255),
    address: z.string().trim().max(300),
    note: z.string().max(20_000),
    /** Id interne du compte technicien, ou `null` pour retirer l'affectation. */
    assigneeUserId: z.string().trim().nullable(),
    /**
     * `userownerid` choisi directement dans le répertoire Dolibarr importé — permet d'affecter un
     * technicien qui n'a pas de compte CRM. Il ne recevra alors aucune notification : il n'y a
     * personne à notifier (l'interface le signale).
     */
    dolibarrUserId: z.string().trim().regex(/^\d*$/, "L’identifiant technicien est numérique.").nullable(),
    /** `socid` Dolibarr de la société cliente, accompagné de son nom pour le miroir local. */
    companyId: z.string().trim().regex(/^\d*$/, "L’identifiant société est numérique.").nullable(),
    companyName: z.string().trim().max(200),
    closed: z.boolean(),
  })
  .partial();

/**
 * L'heure saisie est une heure de Paris. Elle est stockée — et renvoyée à Dolibarr — encodée dans
 * les composantes UTC brutes, exactement comme le fait la lecture (`syncInterventionPlannings`).
 * Toute vraie conversion de fuseau ajouterait le décalage une seconde fois.
 */
function parseParisLocal(value: string) {
  return new Date(`${value}:00.000Z`);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  if (!user || !canEditDolibarrIntervention(user.role)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }
  const { id } = await params;

  const intervention = await prisma.interventionPlanning.findUnique({ where: { id } });
  if (!intervention) {
    return NextResponse.json({ error: "Intervention introuvable." }, { status: 404 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Le contenu JSON n'est pas valide." }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Données invalides." },
      { status: 400 },
    );
  }
  const patch = parsed.data;
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Aucune modification fournie." }, { status: 400 });
  }

  const config = await getDolibarrConfig();
  if (!config) {
    return NextResponse.json({ error: "Dolibarr n’est pas configuré." }, { status: 503 });
  }

  // Réaffectation par identifiant Dolibarr direct (répertoire importé) : on récupère le nom pour
  // le miroir local, et le compte CRM correspondant s'il existe — c'est lui qui sera notifié.
  let directAssignee: { name: string; crmUserId: string | null } | null = null;
  if (patch.dolibarrUserId) {
    const [directoryEntry, crmAccount] = await Promise.all([
      prisma.dolibarrUser.findUnique({
        where: { dolibarrId: patch.dolibarrUserId },
        select: { name: true },
      }),
      prisma.user.findFirst({
        where: { dolibarrUserId: patch.dolibarrUserId },
        select: { id: true },
      }),
    ]);
    if (!directoryEntry) {
      return NextResponse.json(
        { error: "Ce technicien n’est pas dans le répertoire. Relancez l’import depuis les paramètres." },
        { status: 400 },
      );
    }
    directAssignee = { name: directoryEntry.name, crmUserId: crmAccount?.id ?? null };
  }

  // Réaffectation : on traduit le compte interne choisi en `userownerid` Dolibarr.
  let assignee: { id: string; name: string; dolibarrUserId: string | null } | null = null;
  if (patch.assigneeUserId) {
    assignee = await prisma.user.findUnique({
      where: { id: patch.assigneeUserId },
      select: { id: true, name: true, dolibarrUserId: true },
    });
    if (!assignee) {
      return NextResponse.json({ error: "Le technicien sélectionné n’existe plus." }, { status: 400 });
    }
    if (!assignee.dolibarrUserId) {
      return NextResponse.json(
        {
          error:
            `${assignee.name} n’a pas d’identifiant Dolibarr : renseignez-le dans Paramètres → Utilisateurs avant de lui affecter une intervention.`,
        },
        { status: 400 },
      );
    }
  }

  const startAt = patch.startAt !== undefined
    ? (patch.startAt ? parseParisLocal(patch.startAt) : null)
    : undefined;
  const endAt = patch.endAt !== undefined
    ? (patch.endAt ? parseParisLocal(patch.endAt) : null)
    : undefined;

  try {
    await updateDolibarrEvent(config, intervention.dolibarrEventId, {
      ...(startAt !== undefined ? { startAt } : {}),
      ...(endAt !== undefined ? { endAt } : {}),
      ...(patch.title !== undefined ? { label: patch.title } : {}),
      ...(patch.address !== undefined ? { location: patch.address } : {}),
      ...(patch.note !== undefined ? { note: patch.note } : {}),
      ...(patch.assigneeUserId !== undefined
        ? { ownerId: assignee?.dolibarrUserId ?? null }
        : {}),
      ...(patch.dolibarrUserId !== undefined ? { ownerId: patch.dolibarrUserId || null } : {}),
      ...(patch.companyId !== undefined ? { companyId: patch.companyId || null } : {}),
      ...(patch.closed !== undefined ? { closed: patch.closed } : {}),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Écriture Dolibarr impossible.";
    await prisma.interventionPlanning
      .update({ where: { id }, data: { dolibarrLastError: message.slice(0, 1000) } })
      .catch(() => undefined);
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "INTERVENTION_DOLIBARR_ERROR",
        entityType: "InterventionPlanning",
        entityId: id,
        metadata: { error: message.slice(0, 1000) },
      },
    }).catch(() => undefined);
    return NextResponse.json({ error: `Dolibarr a refusé la modification : ${message}` }, { status: 502 });
  }

  // Miroir local mis à jour immédiatement : sans ça, l'écran continuerait d'afficher l'ancienne
  // valeur jusqu'à la prochaine synchronisation (fenêtre d'une heure).
  const previousOwnerId = intervention.dolibarrOwnerId;
  const geocoded =
    patch.address !== undefined && patch.address !== intervention.address
      ? await geocodeAddress(patch.address).catch(() => null)
      : null;

  const updated = await prisma.interventionPlanning.update({
    where: { id },
    data: {
      ...(startAt !== undefined ? { startAt } : {}),
      ...(endAt !== undefined ? { endAt } : {}),
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.address !== undefined ? { address: patch.address } : {}),
      ...(patch.assigneeUserId !== undefined
        ? { dolibarrOwnerId: assignee?.dolibarrUserId ?? null, team: assignee?.name ?? "" }
        : {}),
      ...(patch.dolibarrUserId !== undefined
        ? { dolibarrOwnerId: patch.dolibarrUserId || null, team: directAssignee?.name ?? "" }
        : {}),
      // Le nom du tiers accompagne l'identifiant : le miroir local afficherait sinon l'ancienne
      // société jusqu'à la prochaine synchronisation.
      ...(patch.companyId !== undefined ? { company: patch.companyName ?? "" } : {}),
      ...(patch.closed !== undefined ? { status: patch.closed ? "CLOTURE" : "OUVERT" } : {}),
      ...(geocoded ? { latitude: geocoded.latitude, longitude: geocoded.longitude } : {}),
      dolibarrLastError: null,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "INTERVENTION_DOLIBARR_EDIT",
      entityType: "InterventionPlanning",
      entityId: id,
      metadata: {
        dolibarrEventId: intervention.dolibarrEventId,
        fields: Object.keys(patch),
      },
    },
  }).catch(() => undefined);

  // Le technicien nouvellement affecté est prévenu — c'est le seul moyen pour lui d'apprendre
  // qu'une intervention lui a été confiée sans ouvrir l'application par hasard.
  // Affectation par identifiant direct : on ne notifie que s'il existe un compte CRM derrière.
  if (
    directAssignee?.crmUserId
    && patch.dolibarrUserId
    && patch.dolibarrUserId !== previousOwnerId
  ) {
    await notifyUser(directAssignee.crmUserId, {
      type: "INTERVENTION_ASSIGNED",
      title: "Nouvelle intervention pour vous",
      body: [updated.title, updated.company].filter(Boolean).join(" · "),
      entityType: "InterventionPlanning",
      entityId: updated.id,
    });
  }

  if (assignee && assignee.dolibarrUserId !== previousOwnerId) {
    await notifyUser(assignee.id, {
      type: "INTERVENTION_ASSIGNED",
      title: "Nouvelle intervention pour vous",
      body: [updated.title, updated.company].filter(Boolean).join(" · "),
      entityType: "InterventionPlanning",
      entityId: updated.id,
    });
  }

  return NextResponse.json({ intervention: serializeIntervention(updated) });
}
