import Link from "next/link";
import { CalendarDays, ChevronRight, CirclePlus, ClipboardList } from "lucide-react";
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

export default async function WorkSheetsPage() {
  const workSheets = await prisma.workSheet.findMany({
    where: { archivedAt: null },
    orderBy: [{ workDate: "desc" }, { createdAt: "desc" }],
    include: { _count: { select: { items: true } } },
  });

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

      {workSheets.length === 0 ? (
        <section className="card worksheet-empty">
          <ClipboardList size={34} />
          <h2>Aucune fiche pour le moment</h2>
          <p>Créez la première fiche à partir du catalogue matériel.</p>
          <Link className="button button-primary" href="/fiches/nouvelle">
            Créer une fiche
          </Link>
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
                      <span className="worksheet-item-count">{workSheet._count.items} article{workSheet._count.items > 1 ? "s" : ""}</span>
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
