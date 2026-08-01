import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getActiveCatalog } from "@/lib/worksheets/catalog";
import { generateWorkSheetReport } from "@/lib/worksheets/report";
import { workSheetPayloadSchema } from "@/lib/worksheets/schema";

export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Le contenu JSON n’est pas valide." }, { status: 400 });
  }

  const parsed = workSheetPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Les données de la fiche ne sont pas valides." }, { status: 400 });
  }

  const data = parsed.data;
  const catalog = await getActiveCatalog();
  const materials = new Map(catalog.flatMap((category) =>
    category.materials.map((material) => [material.id, { category, material }] as const),
  ));
  const selected = data.selections.filter((selection) => selection.selected);
  const invalidSelection = selected.some((selection) => {
    const found = materials.get(selection.materialId);
    if (!found) return true;
    if (found.material.inputType !== "SELECT") return false;
    return !found.material.variants.some((variant) => variant.id === selection.variantId);
  });
  if (invalidSelection) {
    return NextResponse.json(
      { error: "Un matériel ou une variante sélectionnée n’est plus disponible." },
      { status: 400 },
    );
  }
  const reportText = data.reportFrozen
    ? data.reportText
    : generateWorkSheetReport(data, catalog);
  const validTags = await prisma.tag.findMany({
    where: { id: { in: data.tagIds }, active: true },
    select: { id: true },
  });

  const workSheet = await prisma.$transaction(async (tx) => {
    const created = await tx.workSheet.create({
      data: {
        workDate: data.workDate ? new Date(`${data.workDate}T12:00:00Z`) : null,
        client: data.client,
        company: data.company,
        installer: data.installer,
        eventId: data.eventId || null,
        mainInstallations: data.installations.map((item) => item.designation).join("\n"),
        otherMaterials: data.otherMaterials,
        reportText,
        reportFrozen: data.reportFrozen,
        createdById: user.id,
        tags: { create: validTags.map((tag) => ({ tagId: tag.id })) },
      },
    });

    for (const [position, installation] of data.installations.entries()) {
      await tx.workSheetInstallation.create({
        data: {
          workSheetId: created.id,
          designationSnapshot: installation.designation,
          quantity: installation.quantity,
          supplier: installation.supplier,
          sourceSupplier: installation.sourceSupplier,
          deliveryNote: installation.deliveryNote,
          installed: installation.installed,
          position,
        },
      });
    }

    for (const [position, selection] of selected.entries()) {
      const found = materials.get(selection.materialId);
      if (!found) continue;
      const variant = found.material.variants.find((item) => item.id === selection.variantId);
      await tx.workSheetItem.create({
        data: {
          workSheetId: created.id,
          materialId: found.material.id,
          variantId: variant?.id,
          categoryNameSnapshot: found.category.name,
          materialNameSnapshot: found.material.name,
          reportLabelSnapshot: found.material.reportLabel,
          variantNameSnapshot: variant?.name,
          variantReportSnapshot: variant?.reportLabel,
          unitSnapshot: found.material.unit,
          quantity: selection.quantity || 1,
          detailValue: selection.detailValue || null,
          supplier: found.material.allowSupplier ? selection.supplier : "INTERNAL",
          installed: found.material.allowNotInstalled ? selection.installed : true,
          position,
        },
      });
    }
    await tx.auditLog.create({
      data: { userId: user.id, action: "WORKSHEET_CREATE", entityType: "WorkSheet", entityId: created.id },
    });
    return created;
  });

  return NextResponse.json({ id: workSheet.id }, { status: 201 });
}
