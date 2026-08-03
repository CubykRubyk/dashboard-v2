import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { canViewSav } from "@/lib/auth/permissions";
import { getMultiStopRoute, getOptimizedStopOrder } from "@/lib/geo/routing";

const bodySchema = z.object({
  points: z
    .array(z.object({ id: z.string(), lat: z.number(), lng: z.number() }))
    .min(2)
    .max(20),
  optimize: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user || !canViewSav(user.role)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Le contenu JSON n'est pas valide." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides." }, { status: 400 });
  }
  const { points, optimize } = parsed.data;
  const coordinates: [number, number][] = points.map((point) => [point.lat, point.lng]);

  if (optimize) {
    const trip = await getOptimizedStopOrder(coordinates);
    if (!trip) {
      return NextResponse.json({ error: "Calcul d'itinéraire impossible." }, { status: 502 });
    }
    return NextResponse.json({
      order: trip.order.map((index) => points[index].id),
      legs: trip.legs,
      totalDistanceKm: trip.totalDistanceKm,
      totalTravelMinutes: trip.totalTravelMinutes,
      geometry: trip.geometry,
    });
  }

  const route = await getMultiStopRoute(coordinates);
  if (!route) {
    return NextResponse.json({ error: "Calcul d'itinéraire impossible." }, { status: 502 });
  }
  return NextResponse.json({
    legs: route.legs,
    totalDistanceKm: route.totalDistanceKm,
    totalTravelMinutes: route.totalTravelMinutes,
    geometry: route.geometry,
  });
}
