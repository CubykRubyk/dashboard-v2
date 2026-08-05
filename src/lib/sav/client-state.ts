import type { SavStatus } from "@/generated/prisma/enums";

/**
 * État tel que le voit la société cliente : « en cours », « planifié », « résolu ».
 *
 * Dérivé des données, jamais stocké — exactement comme les colonnes du Kanban
 * (`kanbanColumnOf` dans `PlanificationSavDashboard.tsx`) : un ticket ouvert sans date est en
 * cours, avec une date il est planifié, et clôturé il est résolu. Deux sources de vérité pour la
 * même notion finiraient par diverger.
 */
export type SavClientState = "OUVERT" | "PLANIFIE" | "CLOTURE";

export function clientFacingState(ticket: {
  status: SavStatus;
  planningDate: Date | null;
}): SavClientState {
  if (ticket.status === "CLOTURE") return "CLOTURE";
  return ticket.planningDate ? "PLANIFIE" : "OUVERT";
}
