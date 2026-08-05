import "server-only";

import { prisma } from "@/lib/prisma";
import { geocodeAddress } from "@/lib/geo/geocode";
import type { PlanningItem } from "@/components/planification-sav/mock-data";
import { dolibarrRequest, type DolibarrConfig } from "./client";

type DolibarrAgendaEvent = {
  id: string;
  ref?: string;
  label?: string;
  actioncomm?: string;
  datep?: number;
  datef?: number;
  percentage?: string;
  location?: string;
  socid?: string | number | null;
  userownerid?: string | number | null;
};

type DolibarrOwner = { firstname?: string; lastname?: string; color?: string };

// Base Adresse Nationale (géocodeur principal, voir lib/geo/geocode.ts) n'impose pas la politique
// stricte de Nominatim (1/s) — throttle réduit, gardé par précaution pendant une sync par lot.
const GEOCODE_THROTTLE_MS = 300;
const SYNC_WINDOW_DAYS = 14;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function syncInterventionPlannings(config: DolibarrConfig): Promise<void> {
  const from = new Date();
  const to = new Date();
  to.setDate(to.getDate() + SYNC_WINDOW_DAYS);

  const sqlfilters = `(t.datep:>=:'${dateOnly(from)}') and (t.datep:<=:'${dateOnly(to)}')`;
  const events = await dolibarrRequest<DolibarrAgendaEvent[]>(
    config,
    `/agendaevents?sqlfilters=${encodeURIComponent(sqlfilters)}&sortfield=t.datep&sortorder=ASC&limit=100`,
  );

  const companyCache = new Map<string, string>();
  const ownerCache = new Map<string, { name: string; color: string }>();

  for (const event of events) {
    // Événements sans société (congés, notes internes) — pas d'intervention client, mais utiles à
    // afficher sur le calendrier pour visualiser l'indisponibilité d'une équipe.
    let company = "";
    if (event.socid) {
      const socid = String(event.socid);
      if (!companyCache.has(socid)) {
        try {
          const thirdparty = await dolibarrRequest<{ name?: string }>(
            config,
            `/thirdparties/${encodeURIComponent(socid)}`,
          );
          companyCache.set(socid, String(thirdparty.name || "").trim());
        } catch {
          companyCache.set(socid, "");
        }
      }
      company = companyCache.get(socid) || "";
    }

    let team = "";
    let color: string | null = null;
    // Conservé tel quel : c'est cet identifiant, et non le nom affiché, qui rattache
    // l'intervention à un compte technicien (`User.dolibarrUserId`).
    let dolibarrOwnerId: string | null = null;
    if (event.userownerid) {
      const ownerId = String(event.userownerid);
      dolibarrOwnerId = ownerId;
      if (!ownerCache.has(ownerId)) {
        try {
          const owner = await dolibarrRequest<DolibarrOwner>(config, `/users/${encodeURIComponent(ownerId)}`);
          ownerCache.set(ownerId, {
            name: [owner.firstname, owner.lastname].filter(Boolean).join(" ").trim(),
            color: owner.color ? `#${owner.color.replace(/^#/, "")}` : "",
          });
        } catch {
          ownerCache.set(ownerId, { name: "", color: "" });
        }
      }
      const owner = ownerCache.get(ownerId)!;
      team = owner.name;
      color = owner.color || null;
    }

    const address = String(event.location || "").trim();
    const title = String(event.label || event.actioncomm || "").trim();
    // Sur cette instance Dolibarr, `datep`/`datef` encodent déjà l'heure locale Europe/Paris (pas une
    // vraie conversion UTC) — on lit donc les composantes UTC brutes sans re-convertir de fuseau, sous
    // peine d'un décalage de 1-2h (confirmé en production).
    const startAt = event.datep ? new Date(event.datep * 1000) : null;
    const endAt = typeof event.datef === "number" && event.datef > 0 ? new Date(event.datef * 1000) : null;
    const status = event.percentage === "100" ? "CLOTURE" : "OUVERT";

    const existing = await prisma.interventionPlanning.findUnique({
      where: { dolibarrEventId: event.id },
      select: { address: true, latitude: true, longitude: true },
    });

    let latitude = existing?.latitude ?? null;
    let longitude = existing?.longitude ?? null;
    const addressChanged = address !== existing?.address;
    const previouslyUnresolved = Boolean(existing) && existing?.latitude === null;
    if (address && (addressChanged || previouslyUnresolved)) {
      const geocoded = await geocodeAddress(address);
      latitude = geocoded?.latitude ?? null;
      longitude = geocoded?.longitude ?? null;
      await sleep(GEOCODE_THROTTLE_MS);
    }

    await prisma.interventionPlanning.upsert({
      where: { dolibarrEventId: event.id },
      create: {
        dolibarrEventId: event.id,
        reference: event.ref || event.id,
        title,
        company,
        address,
        latitude,
        longitude,
        startAt,
        endAt,
        team,
        dolibarrOwnerId,
        color,
        status,
      },
      update: {
        reference: event.ref || event.id,
        title,
        company,
        address,
        latitude,
        longitude,
        startAt,
        endAt,
        team,
        // Doit figurer ici aussi, pas seulement dans `create` : les lignes déjà synchronisées
        // resteraient sinon sans propriétaire, et les techniciens ne verraient aucune de leurs
        // interventions existantes (le champ ne se remplirait que pour les nouveaux événements).
        dolibarrOwnerId,
        color,
        status,
      },
    });
  }

  await prisma.appSettings.update({
    where: { id: 1 },
    data: { dolibarrEventsSyncedAt: new Date(), dolibarrLastSyncError: null },
  });
}

export function serializeIntervention(row: {
  id: string;
  dolibarrEventId: string;
  reference: string;
  title: string;
  company: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  startAt: Date | null;
  endAt: Date | null;
  team: string;
  color: string | null;
  status: "OUVERT" | "CLOTURE";
}): PlanningItem {
  const startAt = row.startAt ?? new Date();
  const startDateIso = startAt.toISOString().slice(0, 10);
  const endDateIso = row.endAt ? row.endAt.toISOString().slice(0, 10) : undefined;
  return {
    id: row.id,
    kind: "intervention",
    dolibarrEventId: row.dolibarrEventId,
    reference: row.reference,
    title: row.title,
    company: row.company,
    contact: "",
    phone: "",
    address: row.address,
    coordinates: row.latitude !== null && row.longitude !== null ? [row.latitude, row.longitude] : null,
    date: startDateIso,
    endDate: endDateIso && endDateIso !== startDateIso ? endDateIso : undefined,
    time: row.startAt
      ? `${String(startAt.getUTCHours()).padStart(2, "0")}:${String(startAt.getUTCMinutes()).padStart(2, "0")}`
      : undefined,
    team: row.team || "Non affectée",
    color: row.color ?? undefined,
    priority: "Normale",
    status: row.status === "CLOTURE" ? "Clôturé" : "Ouvert",
    equipment: "",
    description: "",
    source: "dolibarr",
  };
}
