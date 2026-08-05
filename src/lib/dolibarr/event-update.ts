import "server-only";

import { dolibarrRequest, type DolibarrConfig } from "./client";
import {
  applyEventPatch,
  type DolibarrEventModel,
  type DolibarrEventPatch,
} from "./event-payload";

export type { DolibarrEventPatch } from "./event-payload";

/**
 * Modification d'un événement d'agenda Dolibarr.
 *
 * Règle retenue avec Ion : on **relit l'événement complet, on applique les modifications, puis on
 * renvoie le modèle entier** en PUT. La construction du corps vit dans `event-payload.ts` (pur,
 * testé) ; ce module ne fait que les deux appels réseau.
 */
export async function fetchDolibarrEvent(config: DolibarrConfig, eventId: string) {
  return dolibarrRequest<DolibarrEventModel>(
    config,
    `/agendaevents/${encodeURIComponent(eventId)}`,
  );
}

export async function updateDolibarrEvent(
  config: DolibarrConfig,
  eventId: string,
  patch: DolibarrEventPatch,
) {
  const current = await fetchDolibarrEvent(config, eventId);
  const body = applyEventPatch(current, patch);
  await dolibarrRequest(config, `/agendaevents/${encodeURIComponent(eventId)}`, {
    method: "PUT",
    body,
  });
}
