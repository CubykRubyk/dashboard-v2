import { notFound } from "next/navigation";
import { WorkSheetForm } from "@/components/worksheets/WorkSheetForm";
import { prisma } from "@/lib/prisma";
import { getActiveCatalog } from "@/lib/worksheets/catalog";
import type { WorkSheetFormData } from "@/lib/worksheets/types";

export const dynamic = "force-dynamic";

export default async function EditWorkSheetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [catalog, workSheet] = await Promise.all([
    getActiveCatalog(),
    prisma.workSheet.findFirst({
      where: { id, archivedAt: null },
      include: { items: { orderBy: { position: "asc" } } },
    }),
  ]);
  if (!workSheet) notFound();

  const initialData: WorkSheetFormData = {
    workDate: workSheet.workDate?.toISOString().slice(0, 10) || "",
    client: workSheet.client,
    company: workSheet.company,
    installer: workSheet.installer,
    eventId: workSheet.eventId || "",
    mainInstallations: workSheet.mainInstallations,
    otherMaterials: workSheet.otherMaterials,
    reportText: workSheet.reportText,
    reportFrozen: workSheet.reportFrozen,
    selections: workSheet.items.flatMap((item) =>
      item.materialId
        ? [{
            materialId: item.materialId,
            selected: true,
            variantId: item.variantId || "",
            quantity: item.quantity,
            detailValue: item.detailValue || 0,
            supplier: item.supplier,
            installed: item.installed,
          }]
        : [],
    ),
  };

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Fiches chantier</p>
          <h1>Modifier la fiche</h1>
          <p>{workSheet.client || "Client non renseigné"} · dernière modification le {workSheet.updatedAt.toLocaleDateString("fr-FR")}</p>
        </div>
      </div>
      <WorkSheetForm catalog={catalog} workSheetId={workSheet.id} initialData={initialData} />
    </>
  );
}
