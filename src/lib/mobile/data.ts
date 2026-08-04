import "server-only";

import { prisma } from "@/lib/prisma";
import { serializeSavTicket } from "@/lib/sav/mappers";
import { serializeIntervention } from "@/lib/dolibarr/interventions";
import type { PlanningItem } from "@/components/planification-sav/mock-data";

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

export async function loadInterventions(): Promise<PlanningItem[]> {
  const rows = await prisma.interventionPlanning.findMany({ orderBy: { startAt: "asc" } });
  return rows.map(serializeIntervention);
}

export async function loadSavTickets(): Promise<PlanningItem[]> {
  const rows = await prisma.savTicket.findMany({
    include: TICKET_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(serializeSavTicket);
}

export async function loadPlanningItems(): Promise<PlanningItem[]> {
  const [interventions, tickets] = await Promise.all([loadInterventions(), loadSavTickets()]);
  return [...interventions, ...tickets];
}

export async function findPlanningItem(id: string): Promise<PlanningItem | null> {
  const [intervention, ticket] = await Promise.all([
    prisma.interventionPlanning.findUnique({ where: { id } }),
    prisma.savTicket.findUnique({ where: { id }, include: TICKET_INCLUDE }),
  ]);
  if (intervention) return serializeIntervention(intervention);
  if (ticket) return serializeSavTicket(ticket);
  return null;
}
