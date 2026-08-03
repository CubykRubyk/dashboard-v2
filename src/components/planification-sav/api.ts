export interface NewSavPayload {
  title: string;
  company: string;
  contact: string;
  phone?: string;
  address?: string;
  priority?: string;
  equipment?: string;
  description?: string;
}

export interface PatchSavPayload {
  fields?: Record<string, unknown>;
  history?: { type: string; text: string; detail?: string };
}

async function unwrap(responsePromise: Promise<Response>) {
  const response = await responsePromise;
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || "La requête a échoué.");
  }
  return response.json();
}

export function createSavTicket(draft: NewSavPayload) {
  return unwrap(
    fetch("/api/sav", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    }),
  );
}

export function patchSavTicket(id: string, body: PatchSavPayload) {
  return unwrap(
    fetch(`/api/sav/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

export function deleteSavTicket(id: string) {
  return unwrap(fetch(`/api/sav/${id}`, { method: "DELETE" }));
}

export function dismissProximitySuggestion(id: string) {
  return unwrap(fetch(`/api/planification-sav/suggestions/${id}/dismiss`, { method: "POST" }));
}

export interface ItineraryLeg {
  distanceKm: number;
  travelMinutes: number;
}

export interface ItineraryResult {
  order?: string[];
  legs: ItineraryLeg[];
  totalDistanceKm: number;
  totalTravelMinutes: number;
  geometry: [number, number][];
}

export function computeItinerary(
  points: { id: string; lat: number; lng: number }[],
  optimize = false,
): Promise<ItineraryResult> {
  return unwrap(
    fetch("/api/planification-sav/itinerary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ points, optimize }),
    }),
  );
}
