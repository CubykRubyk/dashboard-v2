export type PlanningKind = "sav" | "intervention";
export type PlanningPriority = "Basse" | "Normale" | "Haute" | "Urgente";
export type PlanningStatus = "Ouvert" | "Clôturé";
export type SavHistoryType = "note" | "status" | "priority" | "closure" | "planning";

export interface SavHistoryEntry {
  id: string;
  type: SavHistoryType;
  date: string;
  author: string;
  text: string;
  detail?: string;
}

export interface SavPlanningDraft {
  date: string;
  startTime: string;
  endTime: string;
  team: string;
  interventionId: string;
  note: string;
}

export interface PlanningItem {
  id: string;
  kind: PlanningKind;
  reference: string;
  title: string;
  company: string;
  contact: string;
  phone: string;
  address: string;
  coordinates: [number, number] | null;
  date: string;
  endDate?: string;
  time?: string;
  duration?: string;
  team: string;
  color?: string;
  priority: PlanningPriority;
  status: PlanningStatus;
  equipment: string;
  description: string;
  source: "dashboard" | "dolibarr";
  dolibarrEventId?: string;
  closedAt?: string;
  closureReason?: string;
  closureNote?: string;
  history?: SavHistoryEntry[];
  planningDraft?: SavPlanningDraft;
}

export interface ProximitySuggestion {
  id: string;
  interventionId: string;
  savId: string;
  travelMinutes: number;
  distanceKm: number;
  label: string;
}

// Les intervenants Dolibarr réels sont synchronisés dans `InterventionPlanning` (Prisma) et sérialisés
// via `serializeIntervention` (src/lib/dolibarr/interventions.ts) — plus de données fictives ici.

// Le siège social (DocumentIssuer.isHeadquarters) n'est pas un SAV/une intervention, mais doit pouvoir
// participer à un itinéraire au même titre — on le représente comme un PlanningItem synthétique,
// jamais inséré dans les listes/filtres/calendrier, seulement utilisé pour la construction du trajet.
export const HEADQUARTERS_STOP_ID = "hq-headquarters";

export function buildHeadquartersPlanningItem(headquarters: {
  name: string;
  address: string;
  coordinates: [number, number];
}): PlanningItem {
  return {
    id: HEADQUARTERS_STOP_ID,
    kind: "intervention",
    reference: "SIÈGE",
    title: "Siège social",
    company: headquarters.name,
    contact: "",
    phone: "",
    address: headquarters.address,
    coordinates: headquarters.coordinates,
    date: "",
    team: "",
    priority: "Normale",
    status: "Ouvert",
    equipment: "",
    description: "",
    source: "dashboard",
  };
}

// Les suggestions de proximité (Faza 3b) référenceront des SAV/interventions réels par id, une fois
// le moteur de rapprochement (temps de trajet réel, OSRM) implémenté.
export const proximitySuggestions: ProximitySuggestion[] = [];
