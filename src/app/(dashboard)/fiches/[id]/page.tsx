import { notFound } from "next/navigation";
import { PhotoGalleryButton } from "@/components/worksheets/PhotoGallery";
import { WorkSheetForm } from "@/components/worksheets/WorkSheetForm";
import { getSession } from "@/lib/auth/session";
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
  const [catalog, workSheet, user, photoCount] = await Promise.all([
    getActiveCatalog(),
    prisma.workSheet.findFirst({
      where: { id, archivedAt: null },
      include: {
        installations: { orderBy: { position: "asc" } },
        items: { orderBy: { position: "asc" } },
        tags: { include: { tag: true } },
      },
    }),
    getSession(),
    prisma.workSheetPhoto.count({ where: { workSheetId: id } }),
  ]);
  if (!workSheet) notFound();

  const initialData: WorkSheetFormData = {
    workDate: workSheet.workDate?.toISOString().slice(0, 10) || "",
    client: workSheet.client,
    company: workSheet.company,
    installer: workSheet.installer,
    eventId: workSheet.eventId || "",
    mainInstallations: workSheet.mainInstallations,
    installations: workSheet.installations.length
      ? workSheet.installations.map((installation) => ({
          designation: installation.designationSnapshot,
          quantity: installation.quantity,
          supplier: installation.supplier,
          sourceSupplier: installation.sourceSupplier,
          deliveryNote: installation.deliveryNote,
          installed: installation.installed,
        }))
      : workSheet.mainInstallations
          .split(/\r?\n/)
          .map((designation) => designation.trim())
          .filter(Boolean)
          .map((designation) => ({
            designation,
            quantity: 1,
            supplier: "INTERNAL" as const,
            sourceSupplier: "",
            deliveryNote: "",
            installed: true,
          })),
    otherMaterials: workSheet.otherMaterials,
    reportText: workSheet.reportText,
    reportFrozen: workSheet.reportFrozen,
    tagIds: workSheet.tags.map(({ tagId }) => tagId),
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
        <div className="page-heading-actions">
          <PhotoGalleryButton workSheetId={workSheet.id} photoCount={photoCount} />
        </div>
      </div>
      <WorkSheetForm
        catalog={catalog}
        workSheetId={workSheet.id}
        initialData={initialData}
        initialDolibarrSentAt={workSheet.dolibarrSentAt?.toISOString()}
        initialStatus={workSheet.status}
        canDeletePermanently={user?.role === "ADMIN"}
        tags={[
          ...(await prisma.tag.findMany({
            where: { active: true },
            orderBy: [{ position: "asc" }, { name: "asc" }],
          })),
          ...workSheet.tags.map(({ tag }) => tag).filter((tag) => !tag.active),
        ]}
      />
    </>
  );
}
