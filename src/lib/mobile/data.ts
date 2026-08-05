import "server-only";

import { prisma } from "@/lib/prisma";
import { serializeSavTicket } from "@/lib/sav/mappers";
import { serializeIntervention } from "@/lib/dolibarr/interventions";
import type { PlanningItem } from "@/components/planification-sav/mock-data";

import { getMobileScope, type MobileScope } from "./scope";

const TICKET_INCLUDE = {
  team: true,
  history: { include: { author: true }, orderBy: { createdAt: "desc" as const } },
};

// `startAt` encode l'heure locale Europe/Paris dans les composantes UTC brutes (voir
// `syncInterventionPlannings`) — on compare donc sur la chaîne "YYYY-MM-DD" déjà produite par
// `serializeIntervention`, pas sur un Date reconverti.
export function todayIsoParis(): string {
  const parts = new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/**
 * Filtre appliqué aux interventions selon le périmètre.
 *
 * Un technicien ne voit que les interventions dont le propriétaire Dolibarr correspond à son
 * compte. S'il n'a pas de rattachement (`dolibarrUserId` vide), le filtre est volontairement
 * impossible à satisfaire : mieux vaut une liste vide — que l'interface signale comme un compte
 * incomplet — qu'un technicien voyant les tournées de tout le monde.
 */
function interventionScopeFilter(scope: MobileScope | null) {
  if (!scope?.ownWorkOnly) return {};
  return { dolibarrOwnerId: scope.dolibarrUserId ?? "__aucun__" };
}

export async function loadInterventions(scope?: MobileScope | null): Promise<PlanningItem[]> {
  const resolved = scope === undefined ? await getMobileScope() : scope;
  const rows = await prisma.interventionPlanning.findMany({
    where: interventionScopeFilter(resolved),
    orderBy: { startAt: "asc" },
  });
  return rows.map(serializeIntervention);
}

/**
 * Les techniciens ne voient aucun SAV (décision explicite d'Ion) : le SAV reste une matière de
 * gestion interne, et une fois planifié il leur parvient de toute façon sous forme d'intervention.
 */
export async function loadSavTickets(scope?: MobileScope | null): Promise<PlanningItem[]> {
  const resolved = scope === undefined ? await getMobileScope() : scope;
  if (resolved?.ownWorkOnly) return [];

  const rows = await prisma.savTicket.findMany({
    include: TICKET_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(serializeSavTicket);
}

export async function loadPlanningItems(scope?: MobileScope | null): Promise<PlanningItem[]> {
  const resolved = scope === undefined ? await getMobileScope() : scope;
  const [interventions, tickets] = await Promise.all([
    loadInterventions(resolved),
    loadSavTickets(resolved),
  ]);
  return [...interventions, ...tickets];
}

export async function findPlanningItem(
  id: string,
  scope?: MobileScope | null,
): Promise<PlanningItem | null> {
  const resolved = scope === undefined ? await getMobileScope() : scope;

  const intervention = await prisma.interventionPlanning.findFirst({
    // Le filtre de périmètre est répété ici : sans lui, un technicien accédant directement à
    // `/mobile/item/<id>` verrait le détail d'une intervention qui ne lui appartient pas, alors
    // même qu'elle n'apparaît dans aucune de ses listes.
    where: { id, ...interventionScopeFilter(resolved) },
  });
  if (intervention) return serializeIntervention(intervention);

  if (resolved?.ownWorkOnly) return null;
  const ticket = await prisma.savTicket.findUnique({ where: { id }, include: TICKET_INCLUDE });
  return ticket ? serializeSavTicket(ticket) : null;
}

/** Chantiers réalisés par le technicien : uniquement les fiches réellement envoyées à Dolibarr. */
export async function loadCompletedWorkSites(scope: MobileScope) {
  const sheets = await prisma.workSheet.findMany({
    where: {
      status: "SENT",
      archivedAt: null,
      ...(scope.ownWorkOnly ? { createdById: scope.userId } : {}),
    },
    orderBy: [{ workDate: "desc" }, { createdAt: "desc" }],
    take: 100,
    select: {
      id: true,
      client: true,
      company: true,
      workDate: true,
      dolibarrSentAt: true,
      createdAt: true,
      _count: { select: { photos: true } },
    },
  });

  return sheets.map((sheet) => ({
    id: sheet.id,
    client: sheet.client,
    company: sheet.company,
    // `workDate` peut être absent sur d'anciennes fiches : on retombe sur la date d'envoi.
    date: (sheet.workDate ?? sheet.dolibarrSentAt ?? sheet.createdAt).toISOString().slice(0, 10),
    photoCount: sheet._count.photos,
  }));
}
