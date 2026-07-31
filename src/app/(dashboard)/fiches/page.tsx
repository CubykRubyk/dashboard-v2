import Link from "next/link";
import { CalendarDays, ChevronRight, CirclePlus, ClipboardList, RotateCcw, Search } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { WorkSheetStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const statusLabels: Record<WorkSheetStatus, string> = {
  DRAFT: "Brouillon",
  COMPLETED: "Terminée",
  SENT: "Envoyée",
};

const monthFormatter = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
  timeZone: "Europe/Paris",
});

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Europe/Paris",
});

function valueOf(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

export default async function WorkSheetsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = valueOf(params.q).trim().slice(0, 120);
  const installer = valueOf(params.installer).slice(0, 180);
  const company = valueOf(params.company).slice(0, 180);
  const tagId = valueOf(params.tag).slice(0, 80);
  const month = /^\d{4}-\d{2}$/.test(valueOf(params.month)) ? valueOf(params.month) : "";
  const statusValue = valueOf(params.status);
  const status = Object.values(WorkSheetStatus).includes(statusValue as WorkSheetStatus)
    ? statusValue as WorkSheetStatus
    : "";
  const dolibarr = ["sent", "pending"].includes(valueOf(params.dolibarr))
    ? valueOf(params.dolibarr)
    : "";

  const where: Prisma.WorkSheetWhereInput = { archivedAt: null };
  const and: Prisma.WorkSheetWhereInput[] = [];
  if (query) {
    and.push({
      OR: [
        { client: { contains: query, mode: "insensitive" } },
        { company: { contains: query, mode: "insensitive" } },
        { installer: { contains: query, mode: "insensitive" } },
        { eventId: { contains: query, mode: "insensitive" } },
      ],
    });
  }
  if (installer) and.push({ installer });
  if (company) and.push({ company });
  if (tagId) and.push({ tags: { some: { tagId } } });
  if (status) and.push({ status });
  if (dolibarr === "sent") and.push({ dolibarrSentAt: { not: null } });
  if (dolibarr === "pending") and.push({ dolibarrSentAt: null });
  if (month) {
    const [year, monthNumber] = month.split("-").map(Number);
    and.push({
      workDate: {
        gte: new Date(Date.UTC(year, monthNumber - 1, 1)),
        lt: new Date(Date.UTC(year, monthNumber, 1)),
      },
    });
  }
  if (and.length) where.AND = and;

  const [workSheets, installerRows, companyRows, tags] = await Promise.all([
    prisma.workSheet.findMany({
    where,
    orderBy: [{ workDate: "desc" }, { createdAt: "desc" }],
    include: {
      tags: { include: { tag: true } },
    },
    }),
    prisma.workSheet.findMany({
      where: { archivedAt: null, installer: { not: "" } },
      distinct: ["installer"],
      orderBy: { installer: "asc" },
      select: { installer: true },
    }),
    prisma.workSheet.findMany({
      where: { archivedAt: null, company: { not: "" } },
      distinct: ["company"],
      orderBy: { company: "asc" },
      select: { company: true },
    }),
    prisma.tag.findMany({
      where: { active: true },
      orderBy: [{ position: "asc" }, { name: "asc" }],
    }),
  ]);
  const isFiltered = Boolean(query || installer || company || tagId || month || status || dolibarr);

  const grouped = new Map<string, typeof workSheets>();
  for (const workSheet of workSheets) {
    const referenceDate = workSheet.workDate || workSheet.createdAt;
    const key = `${referenceDate.getUTCFullYear()}-${referenceDate.getUTCMonth()}`;
    grouped.set(key, [...(grouped.get(key) || []), workSheet]);
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Suivi des chantiers</p>
          <h1>Fiches chantier</h1>
          <p>Retrouvez les fiches enregistrées et leurs rapports.</p>
        </div>
        <Link className="button button-primary" href="/fiches/nouvelle">
          <CirclePlus size={17} /> Nouvelle fiche
        </Link>
      </div>

      <form className="card worksheet-filters" method="get">
        <label className="filter-search">
          <span>Recherche</span>
          <span className="filter-input-shell">
            <Search size={16} />
            <input name="q" defaultValue={query} placeholder="Client, société ou ID Dolibarr" />
          </span>
        </label>
        <label>
          <span>Technicien</span>
          <select name="installer" defaultValue={installer}>
            <option value="">Tous</option>
            {installerRows.map((row) => <option key={row.installer} value={row.installer}>{row.installer}</option>)}
          </select>
        </label>
        <label>
          <span>Société</span>
          <select name="company" defaultValue={company}>
            <option value="">Toutes</option>
            {companyRows.map((row) => <option key={row.company} value={row.company}>{row.company}</option>)}
          </select>
        </label>
        <label>
          <span>Tag</span>
          <select name="tag" defaultValue={tagId}>
            <option value="">Tous</option>
            {tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
          </select>
        </label>
        <label>
          <span>Mois</span>
          <input name="month" type="month" defaultValue={month} />
        </label>
        <label>
          <span>État</span>
          <select name="status" defaultValue={status}>
            <option value="">Tous</option>
            {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>
          <span>Dolibarr</span>
          <select name="dolibarr" defaultValue={dolibarr}>
            <option value="">Tous</option>
            <option value="sent">Envoyée</option>
            <option value="pending">Non envoyée</option>
          </select>
        </label>
        <div className="filter-actions">
          <button className="button button-primary" type="submit"><Search size={16} /> Filtrer</button>
          {isFiltered && <Link className="button button-ghost" href="/fiches"><RotateCcw size={15} /> Réinitialiser</Link>}
        </div>
      </form>

      {workSheets.length === 0 ? (
        <section className="card worksheet-empty">
          <ClipboardList size={34} />
          <h2>{isFiltered ? "Aucune fiche ne correspond aux filtres" : "Aucune fiche pour le moment"}</h2>
          <p>{isFiltered ? "Modifiez ou réinitialisez les critères de recherche." : "Créez la première fiche à partir du catalogue matériel."}</p>
          {isFiltered
            ? <Link className="button button-ghost" href="/fiches"><RotateCcw size={15} /> Réinitialiser les filtres</Link>
            : <Link className="button button-primary" href="/fiches/nouvelle">Créer une fiche</Link>}
        </section>
      ) : (
        <div className="worksheet-months">
          {[...grouped.entries()].map(([key, entries]) => {
            const referenceDate = entries[0].workDate || entries[0].createdAt;
            return (
              <section className="worksheet-month" key={key}>
                <div className="worksheet-month-heading">
                  <CalendarDays size={16} />
                  <h2>{monthFormatter.format(referenceDate)}</h2>
                  <span>{entries.length} fiche{entries.length > 1 ? "s" : ""}</span>
                </div>
                <div className="card worksheet-list">
                  {entries.map((workSheet) => (
                    <Link className="worksheet-list-row" href={`/fiches/${workSheet.id}`} key={workSheet.id}>
                      <div className="worksheet-list-date">
                        <strong>{workSheet.workDate ? dateFormatter.format(workSheet.workDate) : "Sans date"}</strong>
                        <span>{workSheet.installer || "Installateur non renseigné"}</span>
                      </div>
                      <div className="worksheet-list-client">
                        <strong>{workSheet.client || "Client non renseigné"}</strong>
                        <span>{workSheet.company || "Société non renseignée"}</span>
                      </div>
                      <span className="worksheet-list-tags">
                        {workSheet.tags.length > 0
                          ? workSheet.tags.map(({ tag }) => (
                              <span className="tag-mini" style={{ backgroundColor: tag.color }} key={tag.id}>
                                {tag.name}
                              </span>
                            ))
                          : <span className="tag-empty">Aucun tag</span>}
                      </span>
                      <span className={`worksheet-status status-${workSheet.status.toLowerCase()}`}>
                        {statusLabels[workSheet.status]}
                      </span>
                      <ChevronRight size={18} />
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
