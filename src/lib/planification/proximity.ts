import "server-only";

import { prisma } from "@/lib/prisma";
import { getDrivingRoute } from "@/lib/geo/routing";

// Pré-filtre Haversine (calcul pur, aucun appel réseau) — marge généreuse par rapport au rayon max
// affiché en UI (100km), pour que des trajets routiers sinueux ne soient jamais exclus à tort. Borne
// aussi le nombre d'appels OSRM à passer.
const HAVERSINE_PREFILTER_KM = 60;
const OSRM_THROTTLE_MS = 500;
const MAX_OSRM_CALLS = 50;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function haversineKm(a: [number, number], b: [number, number]) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(h));
}

export async function computeProximitySuggestions(): Promise<void> {
  const [eligibleSavTickets, interventionRows] = await Promise.all([
    prisma.savTicket.findMany({
      where: {
        status: "OUVERT",
        planningDate: null,
        latitude: { not: null },
        longitude: { not: null },
      },
      select: { id: true, address: true, latitude: true, longitude: true },
    }),
    prisma.interventionPlanning.findMany({
      where: {
        startAt: { gte: new Date() },
        latitude: { not: null },
        longitude: { not: null },
      },
      select: { id: true, team: true, startAt: true, latitude: true, longitude: true },
    }),
  ]);

  // Le dimanche est jour off chez le client — ces interventions sont des aide-mémoire, pas des
  // déplacements réels, donc elles ne doivent jamais être proposées comme rapprochement de proximité
  // (sinon un SAV créé depuis une intervention du dimanche se retrouve suggéré en trajet de ~0m avec
  // sa propre intervention source). `startAt` encode l'heure locale Europe/Paris dans les composantes
  // UTC brutes (voir `syncInterventionPlannings`), donc `getUTCDay()` donne le bon jour de semaine.
  const eligibleInterventions = interventionRows.filter(
    (row) => !row.startAt || row.startAt.getUTCDay() !== 0,
  );

  let osrmCalls = 0;

  for (const sav of eligibleSavTickets) {
    const savPoint: [number, number] = [sav.latitude!, sav.longitude!];
    const qualifyingInterventionIds = new Set<string>();

    for (const intervention of eligibleInterventions) {
      const interventionPoint: [number, number] = [intervention.latitude!, intervention.longitude!];
      if (haversineKm(savPoint, interventionPoint) > HAVERSINE_PREFILTER_KM) continue;
      if (osrmCalls >= MAX_OSRM_CALLS) break;

      osrmCalls += 1;
      const route = await getDrivingRoute(savPoint, interventionPoint);
      await sleep(OSRM_THROTTLE_MS);
      if (!route) continue;

      qualifyingInterventionIds.add(intervention.id);

      const existing = await prisma.savProximitySuggestion.findUnique({
        where: { savTicketId_interventionId: { savTicketId: sav.id, interventionId: intervention.id } },
      });

      const snapshotChanged =
        !existing ||
        existing.savAddressSnapshot !== sav.address ||
        existing.interventionStartAtSnapshot?.getTime() !== intervention.startAt?.getTime() ||
        existing.interventionTeamSnapshot !== intervention.team;

      const dismissed = existing?.dismissed && !snapshotChanged ? true : false;

      await prisma.savProximitySuggestion.upsert({
        where: { savTicketId_interventionId: { savTicketId: sav.id, interventionId: intervention.id } },
        create: {
          savTicketId: sav.id,
          interventionId: intervention.id,
          distanceKm: route.distanceKm,
          travelMinutes: route.travelMinutes,
          dismissed: false,
          savAddressSnapshot: sav.address,
          interventionStartAtSnapshot: intervention.startAt,
          interventionTeamSnapshot: intervention.team,
        },
        update: {
          distanceKm: route.distanceKm,
          travelMinutes: route.travelMinutes,
          dismissed,
          ...(dismissed
            ? {}
            : {
                savAddressSnapshot: sav.address,
                interventionStartAtSnapshot: intervention.startAt,
                interventionTeamSnapshot: intervention.team,
              }),
        },
      });
    }

    await prisma.savProximitySuggestion.deleteMany({
      where: {
        savTicketId: sav.id,
        interventionId: { notIn: Array.from(qualifyingInterventionIds) },
      },
    });
  }

  await prisma.appSettings.update({
    where: { id: 1 },
    data: { proximitySuggestionsSyncedAt: new Date() },
  });
}
