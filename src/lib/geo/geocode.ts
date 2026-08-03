import "server-only";

export interface GeocodedPoint {
  latitude: number;
  longitude: number;
}

const NOMINATIM_USER_AGENT = "Damaschin-CRM/2.0 (contact: admin@damaschin.local)";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function queryNominatim(query: string): Promise<GeocodedPoint | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": NOMINATIM_USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const results = (await response.json()) as Array<{ lat: string; lon: string }>;
    const first = results[0];
    if (!first) return null;
    const latitude = Number.parseFloat(first.lat);
    const longitude = Number.parseFloat(first.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return { latitude, longitude };
  } catch {
    return null;
  }
}

// Extrait "CODE POSTAL VILLE" de la fin d'une adresse française (ex. "11 CITE LA FAYETTE 59282 DOUCHY LES
// MINES" → "59282 DOUCHY LES MINES, France") — repli utile quand l'adresse complète (rue/lieu-dit) n'est
// pas connue de Nominatim mais que la ville l'est.
function extractPostalCityQuery(address: string): string | null {
  const match = address.match(/(\d{5})\s+([A-Za-zÀ-ÿ' -]+)\s*$/);
  if (!match) return null;
  return `${match[1]} ${match[2].trim()}, France`;
}

export async function geocodeAddress(address: string): Promise<GeocodedPoint | null> {
  const trimmed = address.trim();
  if (!trimmed) return null;

  const direct = await queryNominatim(trimmed);
  if (direct) return direct;

  const fallbackQuery = extractPostalCityQuery(trimmed);
  if (!fallbackQuery || fallbackQuery.toLowerCase() === `${trimmed}, france`.toLowerCase()) return null;

  await sleep(1_100); // Nominatim: max 1 requête/seconde entre deux appels successifs.
  return queryNominatim(fallbackQuery);
}
