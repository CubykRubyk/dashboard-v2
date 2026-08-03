import "server-only";

export interface GeocodedPoint {
  latitude: number;
  longitude: number;
}

const NOMINATIM_USER_AGENT = "Damaschin-CRM/2.0 (contact: admin@damaschin.local)";
const BAN_MIN_SCORE = 0.5;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface BANFeature {
  geometry: { coordinates: [number, number] };
  properties: { score: number };
}

// Base Adresse Nationale (data.gouv.fr) — service officiel français, gratuit, sans clé requise et sans
// la politique de rate-limit stricte de Nominatim (qui nous a valu un blocage 429 en production après un
// usage intensif pendant le développement). Bien plus précis que Nominatim sur les adresses françaises.
async function queryBAN(query: string): Promise<GeocodedPoint | null> {
  const url = `https://api-adresse.data.gouv.fr/search/?limit=1&q=${encodeURIComponent(query)}`;
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { features?: BANFeature[] };
    const first = body.features?.[0];
    if (!first || first.properties.score < BAN_MIN_SCORE) return null;
    const [longitude, latitude] = first.geometry.coordinates;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return { latitude, longitude };
  } catch {
    return null;
  }
}

// Dernier recours — utile uniquement pour une adresse hors de France, que la BAN ne couvre pas.
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
// MINES" → "59282 DOUCHY LES MINES") — repli utile quand l'adresse complète (rue/lieu-dit) n'est pas
// connue du géocodeur mais que la ville l'est.
function extractPostalCityQuery(address: string): string | null {
  const match = address.match(/(\d{5})\s+([A-Za-zÀ-ÿ' -]+)\s*$/);
  if (!match) return null;
  return `${match[1]} ${match[2].trim()}`;
}

export async function geocodeAddress(address: string): Promise<GeocodedPoint | null> {
  const trimmed = address.trim();
  if (!trimmed) return null;

  const directBan = await queryBAN(trimmed);
  if (directBan) return directBan;

  const fallbackQuery = extractPostalCityQuery(trimmed);
  const hasDistinctFallback = Boolean(fallbackQuery) && fallbackQuery!.toLowerCase() !== trimmed.toLowerCase();

  if (hasDistinctFallback) {
    await sleep(250);
    const fallbackBan = await queryBAN(fallbackQuery!);
    if (fallbackBan) return fallbackBan;
  }

  await sleep(250);
  const directNominatim = await queryNominatim(trimmed);
  if (directNominatim) return directNominatim;

  if (hasDistinctFallback) {
    await sleep(1_100); // Nominatim : max 1 requête/seconde entre deux appels successifs.
    return queryNominatim(`${fallbackQuery}, France`);
  }
  return null;
}
