import { WorkSheetForm } from "@/components/worksheets/WorkSheetForm";
import { getActiveCatalog } from "@/lib/worksheets/catalog";

export default async function NewWorkSheetPage() {
  const catalog = await getActiveCatalog();
  return (
    <>
      <div className="page-heading">
        <div><p className="eyebrow">Fiches chantier</p><h1>Nouvelle fiche</h1><p>Sélectionnez le matériel réellement utilisé sur le chantier.</p></div>
      </div>
      <WorkSheetForm catalog={catalog} />
    </>
  );
}
