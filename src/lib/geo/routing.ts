import "server-only";

export interface DrivingRoute {
  distanceKm: number;
  travelMinutes: number;
}

const OSRM_BASE_URL = "https://router.project-osrm.org";

export async function getDrivingRoute(
  from: [number, number],
  to: [number, number],
): Promise<DrivingRoute | null> {
  const url = `${OSRM_BASE_URL}/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=false`;
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      code?: string;
      routes?: Array<{ distance: number; duration: number }>;
    };
    const route = data.routes?.[0];
    if (data.code !== "Ok" || !route) return null;
    return {
      distanceKm: route.distance / 1000,
      travelMinutes: Math.round(route.duration / 60),
    };
  } catch {
    return null;
  }
}

export interface MultiStopRoute {
  legs: DrivingRoute[];
  totalDistanceKm: number;
  totalTravelMinutes: number;
  geometry: [number, number][];
}

export interface OptimizedStopOrder extends MultiStopRoute {
  order: number[];
}

interface OsrmLeg {
  distance: number;
  duration: number;
}
interface OsrmGeometry {
  type: string;
  coordinates: [number, number][];
}

function coordsParam(points: [number, number][]) {
  return points.map(([lat, lng]) => `${lng},${lat}`).join(";");
}

function toLegs(legs: OsrmLeg[]): DrivingRoute[] {
  return legs.map((leg) => ({
    distanceKm: leg.distance / 1000,
    travelMinutes: Math.round(leg.duration / 60),
  }));
}

function toLatLngGeometry(geometry: OsrmGeometry | undefined): [number, number][] {
  if (!geometry?.coordinates) return [];
  return geometry.coordinates.map(([lng, lat]) => [lat, lng]);
}

export async function getMultiStopRoute(points: [number, number][]): Promise<MultiStopRoute | null> {
  if (points.length < 2) return null;
  const url = `${OSRM_BASE_URL}/route/v1/driving/${coordsParam(points)}?overview=full&geometries=geojson`;
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      code?: string;
      routes?: Array<{ distance: number; duration: number; legs: OsrmLeg[]; geometry?: OsrmGeometry }>;
    };
    const route = data.routes?.[0];
    if (data.code !== "Ok" || !route) return null;
    return {
      legs: toLegs(route.legs),
      totalDistanceKm: route.distance / 1000,
      totalTravelMinutes: Math.round(route.duration / 60),
      geometry: toLatLngGeometry(route.geometry),
    };
  } catch {
    return null;
  }
}

export async function getOptimizedStopOrder(points: [number, number][]): Promise<OptimizedStopOrder | null> {
  if (points.length < 2) return null;
  const url = `${OSRM_BASE_URL}/trip/v1/driving/${coordsParam(points)}?source=first&roundtrip=false&overview=full&geometries=geojson`;
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      code?: string;
      trips?: Array<{ distance: number; duration: number; legs: OsrmLeg[]; geometry?: OsrmGeometry }>;
      waypoints?: Array<{ waypoint_index: number }>;
    };
    const trip = data.trips?.[0];
    if (data.code !== "Ok" || !trip || !data.waypoints) return null;
    const order = new Array<number>(data.waypoints.length);
    data.waypoints.forEach((waypoint, originalIndex) => {
      order[waypoint.waypoint_index] = originalIndex;
    });
    return {
      order,
      legs: toLegs(trip.legs),
      totalDistanceKm: trip.distance / 1000,
      totalTravelMinutes: Math.round(trip.duration / 60),
      geometry: toLatLngGeometry(trip.geometry),
    };
  } catch {
    return null;
  }
}
