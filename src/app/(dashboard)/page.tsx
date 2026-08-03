import Link from "next/link";
import {
  CalendarDays,
  FileOutput,
  FileText,
  History,
  Link2,
  Sparkles,
  Wrench,
} from "lucide-react";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const dateTimeFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function formatAction(action: string) {
  return action
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (char) => char.toUpperCase());
}

function startOfWeek(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

function endOfWeek(date: Date) {
  const end = startOfWeek(date);
  end.setDate(end.getDate() + 7);
  return end;
}

function startOfDay(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

function endOfDay(date: Date) {
  const end = startOfDay(date);
  end.setDate(end.getDate() + 1);
  return end;
}

export default async function DashboardPage() {
  const now = new Date();
  const weekStart = startOfWeek(now);
  const weekEnd = endOfWeek(now);
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  const [
    workSheets,
    generatedDocuments,
    settings,
    savOpen,
    savClosedThisWeek,
    interventionsThisWeek,
    interventionsToday,
    proximitySuggestionsActive,
    recentActivity,
  ] = await Promise.all([
    prisma.workSheet.count({ where: { archivedAt: null } }),
    prisma.generatedDocument.count(),
    prisma.appSettings.findUnique({ where: { id: 1 } }),
    prisma.savTicket.count({ where: { status: "OUVERT" } }),
    prisma.savTicket.count({ where: { status: "CLOTURE", closedAt: { gte: weekStart, lt: weekEnd } } }),
    prisma.interventionPlanning.count({ where: { startAt: { gte: weekStart, lt: weekEnd } } }),
    prisma.interventionPlanning.count({ where: { startAt: { gte: todayStart, lt: todayEnd } } }),
    prisma.savProximitySuggestion.count({ where: { dismissed: false } }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { user: { select: { name: true } } },
    }),
  ]);

  const dolibarrConfigured = Boolean(
    settings?.dolibarrUrl && settings.dolibarrApiKeyEncrypted,
  );

  const cards = [
    { label: "Fiches chantier", value: String(workSheets), note: "Fiches actives", icon: FileText, tone: "primary" },
    { label: "Documents générés", value: String(generatedDocuments), note: "Total, tous modèles", icon: FileOutput, tone: "success" },
    { label: "SAV à traiter", value: String(savOpen), note: `${savClosedThisWeek} clôturé${savClosedThisWeek > 1 ? "s" : ""} cette semaine`, icon: Wrench, tone: "warning" },
    { label: "Interventions", value: String(interventionsThisWeek), note: `${interventionsToday} aujourd’hui`, icon: CalendarDays, tone: "info" },
    { label: "Suggestions de proximité", value: String(proximitySuggestionsActive), note: "Rapprochements SAV/intervention actifs", icon: Sparkles, tone: "success" },
    { label: "Dolibarr", value: dolibarrConfigured ? "Configuré" : "Non configuré", note: "Connexion serveur à serveur", icon: Link2, tone: "primary" },
  ];

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Vue d’ensemble</p>
          <h1>Dashboard</h1>
          <p>Le socle de la nouvelle application est opérationnel.</p>
        </div>
      </div>
      <section className="stats-grid" aria-label="Indicateurs">
        {cards.map(({ label, value, note, icon: Icon, tone }) => (
          <article className="stat-card" key={label}>
            <span className={`stat-icon ${tone}`}><Icon aria-hidden size={22} /></span>
            <div><p>{label}</p><strong>{value}</strong><small>{note}</small></div>
          </article>
        ))}
      </section>
      <section className="content-grid">
        <article className="card">
          <div className="card-header">
            <div><p className="eyebrow">Journal</p><h2>Activité récente</h2></div>
            <Link href="/settings?tab=journal" className="badge badge-success">Voir tout</Link>
          </div>
          <div className="milestone-list">
            {recentActivity.length === 0 && (
              <div className="milestone"><span><History aria-hidden size={13} /></span><div><strong>Aucune activité récente</strong></div></div>
            )}
            {recentActivity.map((entry) => (
              <div className="milestone done" key={entry.id}>
                <span><History aria-hidden size={13} /></span>
                <div>
                  <strong>{formatAction(entry.action)}</strong>
                  <p>{entry.user?.name ?? "Système"} · {dateTimeFormatter.format(entry.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </article>
        <article className="card accent-card">
          <p className="eyebrow">Cette semaine</p>
          <h2>{interventionsThisWeek} intervention{interventionsThisWeek > 1 ? "s" : ""} planifiée{interventionsThisWeek > 1 ? "s" : ""}, {savOpen} SAV en attente.</h2>
          <p>Consultez la carte et l’itinéraire du jour dans Planification &amp; SAV.</p>
        </article>
      </section>
    </>
  );
}
