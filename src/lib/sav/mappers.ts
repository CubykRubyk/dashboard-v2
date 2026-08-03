import type { Prisma } from "@/generated/prisma/client";
import type { SavHistoryType, SavPriority, SavStatus } from "@/generated/prisma/enums";
import type {
  PlanningItem,
  PlanningPriority,
  PlanningStatus,
  SavHistoryEntry,
  SavHistoryType as ClientSavHistoryType,
} from "@/components/planification-sav/mock-data";

export const PRIORITY_TO_DB: Record<PlanningPriority, SavPriority> = {
  Basse: "BASSE",
  Normale: "NORMALE",
  Haute: "HAUTE",
  Urgente: "URGENTE",
};
export const PRIORITY_FROM_DB: Record<SavPriority, PlanningPriority> = {
  BASSE: "Basse",
  NORMALE: "Normale",
  HAUTE: "Haute",
  URGENTE: "Urgente",
};

export const STATUS_TO_DB: Record<PlanningStatus, SavStatus> = {
  Ouvert: "OUVERT",
  "Clôturé": "CLOTURE",
};
export const STATUS_FROM_DB: Record<SavStatus, PlanningStatus> = {
  OUVERT: "Ouvert",
  CLOTURE: "Clôturé",
};

export const HISTORY_TYPE_TO_DB: Record<ClientSavHistoryType, SavHistoryType> = {
  note: "NOTE",
  status: "STATUS",
  priority: "PRIORITY",
  closure: "CLOSURE",
  planning: "PLANNING",
};
export const HISTORY_TYPE_FROM_DB: Record<SavHistoryType, ClientSavHistoryType> = {
  NOTE: "note",
  STATUS: "status",
  PRIORITY: "priority",
  CLOSURE: "closure",
  PLANNING: "planning",
};

export type SavTicketWithRelations = Prisma.SavTicketGetPayload<{
  include: { team: true; history: { include: { author: true } } };
}>;

export function serializeSavTicket(ticket: SavTicketWithRelations): PlanningItem {
  const history: SavHistoryEntry[] = ticket.history.map((entry) => ({
    id: entry.id,
    type: HISTORY_TYPE_FROM_DB[entry.type],
    date: entry.createdAt.toISOString(),
    author: entry.author?.name ?? "Système",
    text: entry.text,
    detail: entry.detail ?? undefined,
  }));

  return {
    id: ticket.id,
    kind: "sav",
    reference: ticket.reference,
    title: ticket.title,
    company: ticket.company,
    contact: ticket.contact,
    phone: ticket.phone,
    address: ticket.address,
    coordinates: ticket.latitude !== null && ticket.longitude !== null ? [ticket.latitude, ticket.longitude] : null,
    date: (ticket.desiredDate ?? ticket.createdAt).toISOString().slice(0, 10),
    team: ticket.team?.name ?? "Non affectée",
    priority: PRIORITY_FROM_DB[ticket.priority],
    status: STATUS_FROM_DB[ticket.status],
    equipment: ticket.equipment,
    description: ticket.description,
    source: "dashboard",
    closedAt: ticket.closedAt?.toISOString(),
    closureReason: ticket.closureReason ?? undefined,
    closureNote: ticket.closureNote ?? undefined,
    history,
    planningDraft: ticket.planningDate
      ? {
          date: ticket.planningDate.toISOString().slice(0, 10),
          startTime: ticket.planningStartTime ?? "",
          endTime: ticket.planningEndTime ?? "",
          team: ticket.team?.name ?? "",
          interventionId: "none",
          note: ticket.planningNote ?? "",
        }
      : undefined,
  };
}
