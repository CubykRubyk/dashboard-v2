import { after } from "next/server";
import { canEditDolibarrIntervention, canManageSav } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { serializeSavTicket } from "@/lib/sav/mappers";
import { getDolibarrConfig } from "@/lib/dolibarr/client";
import { serializeIntervention, syncInterventionPlannings } from "@/lib/dolibarr/interventions";
import { computeProximitySuggestions, startOfTodayParis } from "@/lib/planification/proximity";
import { PlanificationSavDashboard } from "@/components/planification-sav/PlanificationSavDashboard";
import type { ProximitySuggestion } from "@/components/planification-sav/mock-data";

export const metadata = {
  title: "Planification & SAV · Damaschin CRM",
};

export const dynamic = "force-dynamic";

const SYNC_STALE_AFTER_MS = 60 * 60 * 1000;
const PROXIMITY_STALE_AFTER_MS = 20 * 60 * 1000;

function isStale(syncedAt: Date | null | undefined, thresholdMs: number) {
  return !syncedAt || Date.now() - syncedAt.getTime() > thresholdMs;
}

export default async function PlanificationSavPage({
  searchParams,
}: {
  searchParams: Promise<{ open?: string }>;
}) {
  const { open } = await searchParams;
  const sessionUser = await getSession();
  const config = await getDolibarrConfig();
  // La sync Dolibarr (throttle 300ms/adresse geocodée) + le calcul des suggestions de proximité
  // (throttle 500ms/appel OSRM, jusqu'à 50 appels) bloquaient le rendu de la page — la liste SAV
  // pouvait mettre plusieurs dizaines de secondes à s'afficher pendant qu'ils tournaient au premier
  // chargement "périmé". `after()` (Next 15+) les repousse après l'envoi de la réponse : la page
  // s'affiche immédiatement avec les données déjà en base (potentiellement mineures de quelques
  // minutes), et se met à jour pour le prochain chargement une fois la synchro terminée.
  if (config) {
    const settings = await prisma.appSettings.findUnique({ where: { id: 1 } });
    const needsEventSync = isStale(settings?.dolibarrEventsSyncedAt, SYNC_STALE_AFTER_MS);
    const needsProximitySync = isStale(settings?.proximitySuggestionsSyncedAt, PROXIMITY_STALE_AFTER_MS);
    if (needsEventSync || needsProximitySync) {
      after(async () => {
        if (needsEventSync) {
          await syncInterventionPlannings(config).catch(async (error) => {
            console.error("Synchronisation Dolibarr échouée:", error);
            const message = error instanceof Error ? error.message : "Synchronisation Dolibarr échouée.";
            await prisma.appSettings.update({ where: { id: 1 }, data: { dolibarrLastSyncError: message } }).catch(() => {});
          });
        }
        // Après la sync des événements, pas avant — les suggestions dépendent des interventions à jour.
        if (needsProximitySync) {
          await computeProximitySuggestions().catch((error) => {
            console.error("Calcul des suggestions de proximité échoué:", error);
          });
        }
      });
    }
  }

  const [companyRows, ticketRows, teamRows, interventionRows, suggestionRows, headquarters] = await Promise.all([
    prisma.workSheet.findMany({
      where: { archivedAt: null },
      select: { company: true },
      distinct: ["company"],
      orderBy: { company: "asc" },
    }),
    prisma.savTicket.findMany({
      include: { team: true, history: { include: { author: true }, orderBy: { createdAt: "desc" } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.team.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.interventionPlanning.findMany({ orderBy: { startAt: "asc" } }),
    prisma.savProximitySuggestion.findMany({
      where: {
        dismissed: false,
        savTicket: { status: "OUVERT", planningDate: null },
        intervention: { startAt: { gte: startOfTodayParis() } },
      },
      orderBy: { travelMinutes: "asc" },
    }),
    prisma.documentIssuer.findFirst({
      where: { isHeadquarters: true, latitude: { not: null }, longitude: { not: null } },
      select: { name: true, address: true, latitude: true, longitude: true },
    }),
  ]);

  const companies = companyRows
    .map((row) => row.company)
    .filter((company): company is string => Boolean(company?.trim()));
  const tickets = ticketRows.map(serializeSavTicket);
  const teams = teamRows.map((team) => ({ id: team.id, name: team.name }));
  const interventions = interventionRows.map(serializeIntervention);
  const suggestions: ProximitySuggestion[] = suggestionRows.map((row) => ({
    id: row.id,
    interventionId: row.interventionId,
    savId: row.savTicketId,
    travelMinutes: row.travelMinutes,
    distanceKm: row.distanceKm,
    label: "",
  }));

  return (
    <PlanificationSavDashboard
      worksheetCompanies={companies}
      initialTickets={tickets}
      teams={teams}
      interventions={interventions}
      dolibarrConfigured={Boolean(config)}
      initialSuggestions={suggestions}
      initialSelectedId={open || null}
      canManageSav={canManageSav(sessionUser?.role)}
      canEditIntervention={canEditDolibarrIntervention(sessionUser?.role)}
      headquarters={
        headquarters
          ? { name: headquarters.name, address: headquarters.address, coordinates: [headquarters.latitude!, headquarters.longitude!] }
          : null
      }
    />
  );
}
