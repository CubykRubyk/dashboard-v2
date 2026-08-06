import Link from "next/link";
import { BarChart3, Download, FileCheck2, FileSpreadsheet, Send, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const now = new Date();
  const defaultFrom = `${now.getFullYear()}-01-01`;
  const from = /^\d{4}-\d{2}-\d{2}$/.test(first(params.from)) ? first(params.from) : defaultFrom;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(first(params.to))
    ? first(params.to)
    : now.toISOString().slice(0, 10);
  const installer = first(params.installer);
  const company = first(params.company);
  const tagId = first(params.tag);
  const workSheets = await prisma.workSheet.findMany({
    where: {
      archivedAt: null,
      workDate: {
        gte: new Date(`${from}T00:00:00Z`),
        lte: new Date(`${to}T23:59:59Z`),
      },
      ...(installer ? { installer } : {}),
      ...(company ? { company } : {}),
      ...(tagId ? { tags: { some: { tagId } } } : {}),
    },
    include: { tags: { include: { tag: true } }, items: true },
  });
  const allOptions = await prisma.workSheet.findMany({
    where: { archivedAt: null },
    select: { installer: true, company: true },
  });
  const tags = await prisma.tag.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  const installers = [...new Set(allOptions.map((row) => row.installer).filter(Boolean))].sort();
  const companies = [...new Set(allOptions.map((row) => row.company).filter(Boolean))].sort();
  const byInstaller = new Map<string, number>();
  const byCompany = new Map<string, number>();
  const byTag = new Map<string, { name: string; color: string; count: number }>();
  const materials = new Map<string, { name: string; quantity: number }>();
  for (const fiche of workSheets) {
    byInstaller.set(fiche.installer || "Non renseigné", (byInstaller.get(fiche.installer || "Non renseigné") || 0) + 1);
    byCompany.set(fiche.company || "Non renseignée", (byCompany.get(fiche.company || "Non renseignée") || 0) + 1);
    fiche.tags.forEach(({ tag }) => byTag.set(tag.id, { name: tag.name, color: tag.color, count: (byTag.get(tag.id)?.count || 0) + 1 }));
    fiche.items.forEach((item) => {
      const current = materials.get(item.materialNameSnapshot);
      materials.set(item.materialNameSnapshot, { name: item.materialNameSnapshot, quantity: (current?.quantity || 0) + item.quantity });
    });
  }
  const query = new URLSearchParams({ from, to, installer, company, tag: tagId }).toString();
  const completed = workSheets.filter((fiche) => fiche.status !== "DRAFT").length;
  const sent = workSheets.filter((fiche) => fiche.status === "SENT").length;

  return (
    <>
      <div className="page-heading">
        <div><p className="eyebrow">Analyse</p><h1>Statistiques chantier</h1><p>Analysez l’activité et exportez les données filtrées.</p></div>
      </div>
      <form className="card reports-filters" method="get">
        <label>Du<input type="date" name="from" defaultValue={from} /></label>
        <label>Au<input type="date" name="to" defaultValue={to} /></label>
        <label>Technicien<select name="installer" defaultValue={installer}><option value="">Tous</option>{installers.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label>Société<select name="company" defaultValue={company}><option value="">Toutes</option>{companies.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label>Tag<select name="tag" defaultValue={tagId}><option value="">Tous</option>{tags.map((tag) => <option value={tag.id} key={tag.id}>{tag.name}</option>)}</select></label>
        <button className="button button-primary">Appliquer</button>
      </form>
      <section className="stats-grid reports-stats">
        <article className="stat-card"><span className="stat-icon primary"><BarChart3 size={22} /></span><div><p>Chantiers</p><strong>{workSheets.length}</strong><small>Période filtrée</small></div></article>
        <article className="stat-card"><span className="stat-icon success"><FileCheck2 size={22} /></span><div><p>Terminées</p><strong>{completed}</strong><small>{workSheets.length ? Math.round(completed / workSheets.length * 100) : 0}% du total</small></div></article>
        <article className="stat-card"><span className="stat-icon info"><Send size={22} /></span><div><p>Envoyées</p><strong>{sent}</strong><small>Vers Dolibarr</small></div></article>
        <article className="stat-card"><span className="stat-icon warning"><Users size={22} /></span><div><p>Techniciens</p><strong>{byInstaller.size}</strong><small>Actifs sur la période</small></div></article>
      </section>
      <div className="reports-grid">
        <section className="card report-ranking"><h2>Par technicien</h2>{[...byInstaller.entries()].sort((a,b) => b[1]-a[1]).map(([name,count]) => <div key={name}><span>{name}</span><strong>{count}</strong></div>)}</section>
        <section className="card report-ranking"><h2>Par société</h2>{[...byCompany.entries()].sort((a,b) => b[1]-a[1]).map(([name,count]) => <div key={name}><span>{name}</span><strong>{count}</strong></div>)}</section>
        <section className="card report-ranking"><h2>Par type d’installation</h2>{[...byTag.values()].sort((a,b) => b.count-a.count).map((tag) => <div key={tag.name}><span><i style={{ background: tag.color }} />{tag.name}</span><strong>{tag.count}</strong></div>)}</section>
        <section className="card report-ranking"><h2>Matériels utilisés</h2>{[...materials.values()].sort((a,b) => b.quantity-a.quantity).slice(0,15).map((item) => <div key={item.name}><span>{item.name}</span><strong>{item.quantity.toLocaleString("fr-FR")}</strong></div>)}</section>
      </div>
      <section className="card reports-export">
        <div><h2>Exporter les résultats</h2><p>Excel (.xlsx) avec filtres et colonnes ajustées, ou CSV pour réimporter ailleurs.</p></div>
        <Link className="button button-primary" href={`/api/reports/export?type=worksheets&format=xlsx&${query}`}><FileSpreadsheet size={16} /> Fiches (Excel)</Link>
        <Link className="button button-primary" href={`/api/reports/export?type=materials&format=xlsx&${query}`}><FileSpreadsheet size={16} /> Matériels (Excel)</Link>
        <Link className="button button-ghost" href={`/api/reports/export?type=worksheets&${query}`}><Download size={16} /> Fiches (CSV)</Link>
        <Link className="button button-ghost" href={`/api/reports/export?type=materials&${query}`}><Download size={16} /> Matériels (CSV)</Link>
      </section>
    </>
  );
}
