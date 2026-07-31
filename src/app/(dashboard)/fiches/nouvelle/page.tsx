import { WorkSheetForm } from "@/components/worksheets/WorkSheetForm";
import { getActiveCatalog } from "@/lib/worksheets/catalog";
import { prisma } from "@/lib/prisma";

export default async function NewWorkSheetPage() {
  const [catalog, tags] = await Promise.all([
    getActiveCatalog(),
    prisma.tag.findMany({ where: { active: true }, orderBy: [{ position: "asc" }, { name: "asc" }] }),
  ]);
  return (
    <>
      <div className="page-heading">
        <div><p className="eyebrow">Fiches chantier</p><h1>Nouvelle fiche</h1><p>Sélectionnez le matériel réellement utilisé sur le chantier.</p></div>
      </div>
      <WorkSheetForm catalog={catalog} tags={tags} />
    </>
  );
}
