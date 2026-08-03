import type { PlanningItem } from "@/components/planification-sav/mock-data";
import franceDepartementsGeoJson from "@/data/france-departements.json";

export type DepartmentGeometry = GeoJSON.Polygon | GeoJSON.MultiPolygon;

export interface DepartmentFeature {
  code: string;
  nom: string;
  geometry: DepartmentGeometry;
}

// Positions fixes pour la cartogramme en grille (façon "carte en carrés" INSEE/presse française) —
// générées une seule fois à partir des centroïdes réels du GeoJSON ci-dessous (binning + relocation
// des cellules en collision vers la cellule libre la plus proche). Pas recalculées dans le navigateur.
export const CARTOGRAM_POSITIONS: Record<string, [row: number, col: number]> = {
  "01": [7, 11], "02": [2, 9], "03": [7, 9], "04": [10, 12], "05": [9, 12], "06": [11, 13], "07": [9, 10], "08": [1, 11],
  "09": [12, 7], "10": [4, 10], "11": [12, 8], "12": [10, 8], "13": [11, 11], "14": [2, 5], "15": [9, 8], "16": [8, 5],
  "17": [8, 4], "18": [6, 8], "19": [8, 7], "21": [5, 11], "22": [3, 2], "23": [7, 7], "24": [9, 6], "25": [6, 13],
  "26": [9, 11], "27": [2, 6], "28": [3, 7], "29": [4, 0], "2A": [14, 16], "2B": [13, 16], "30": [11, 10], "31": [12, 6],
  "32": [11, 6], "33": [9, 4], "34": [11, 9], "35": [4, 3], "36": [6, 7], "37": [5, 6], "38": [8, 12], "39": [6, 12],
  "40": [11, 4], "41": [5, 7], "42": [8, 10], "43": [9, 9], "44": [5, 3], "45": [4, 8], "46": [10, 7], "47": [10, 6],
  "48": [10, 9], "49": [5, 4], "50": [2, 3], "51": [3, 10], "52": [4, 11], "53": [4, 4], "54": [3, 12], "55": [2, 11],
  "56": [4, 2], "57": [2, 13], "58": [5, 9], "59": [0, 9], "60": [2, 8], "61": [3, 5], "62": [0, 8], "63": [8, 9],
  "64": [12, 4], "65": [12, 5], "66": [13, 8], "67": [3, 14], "68": [4, 14], "69": [6, 11], "70": [5, 12], "71": [6, 10],
  "72": [4, 5], "73": [8, 13], "74": [7, 13], "75": [3, 8], "76": [1, 6], "77": [3, 9], "78": [3, 6], "79": [6, 5],
  "80": [1, 8], "81": [11, 8], "82": [9, 7], "83": [12, 12], "84": [10, 11], "85": [6, 3], "86": [6, 6], "87": [7, 6],
  "88": [4, 12], "89": [4, 9], "90": [5, 13], "91": [4, 7], "92": [5, 8], "93": [1, 7], "94": [1, 9], "95": [2, 7],
};

let cachedDepartments: DepartmentFeature[] | null = null;

// Contour des 96 départements métropolitains — `gregoiredavid/france-geojson` (Licence Ouverte /
// Open Licence, IGN/data.gouv.fr), précision réduite à 3 décimales pour rester léger côté client.
export function getDepartments(): DepartmentFeature[] {
  if (cachedDepartments) return cachedDepartments;
  const collection = franceDepartementsGeoJson as unknown as {
    features: { properties: { code: string; nom: string }; geometry: DepartmentGeometry }[];
  };
  cachedDepartments = collection.features.map((feature) => ({
    code: feature.properties.code,
    nom: feature.properties.nom,
    geometry: feature.geometry,
  }));
  return cachedDepartments;
}

function pointInRing(lng: number, lat: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInGeometry(lng: number, lat: number, geometry: DepartmentGeometry): boolean {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polygons.some((rings) => pointInRing(lng, lat, rings[0] as [number, number][]));
}

// Point-in-polygon (ray casting) — dérive le département directement des coordonnées déjà présentes
// sur chaque `PlanningItem` (géocodage existant), sans dépendre du texte libre de l'adresse ni d'une
// colonne de plus dans Prisma.
export function findDepartmentForPoint(lat: number, lng: number): { code: string; nom: string } | null {
  for (const department of getDepartments()) {
    if (pointInGeometry(lng, lat, department.geometry)) {
      return { code: department.code, nom: department.nom };
    }
  }
  return null;
}

export interface DepartmentGroup {
  code: string;
  nom: string;
  savItems: PlanningItem[];
  interventionItems: PlanningItem[];
}

// "Aujourd'hui" côté Paris — utilisé pour ne montrer, en mode cartogramme/départements, que les
// interventions du jour même ou à venir (une intervention d'hier n'a plus d'intérêt sur ces vues
// d'ensemble, contrairement à un SAV qui reste ouvert tant qu'il n'est pas traité). `PlanningItem.date`
// est déjà une chaîne "YYYY-MM-DD" — comparaison lexicographique directe, pas de piège de fuseau.
export function getTodayIsoDateParis(): string {
  const parts = new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function groupItemsByDepartment(items: PlanningItem[]): Map<string, DepartmentGroup> {
  const today = getTodayIsoDateParis();
  const groups = new Map<string, DepartmentGroup>();
  for (const item of items) {
    if (!item.coordinates) continue;
    if (item.kind === "intervention" && item.date && item.date < today) continue;
    const [lat, lng] = item.coordinates;
    const department = findDepartmentForPoint(lat, lng);
    if (!department) continue;
    let group = groups.get(department.code);
    if (!group) {
      group = { code: department.code, nom: department.nom, savItems: [], interventionItems: [] };
      groups.set(department.code, group);
    }
    if (item.kind === "sav") group.savItems.push(item);
    else group.interventionItems.push(item);
  }
  return groups;
}
