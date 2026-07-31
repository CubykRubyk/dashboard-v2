import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getActiveCatalog } from "@/lib/worksheets/catalog";
import { generateWorkSheetReport } from "@/lib/worksheets/report";
import { workSheetPayloadSchema } from "@/lib/worksheets/schema";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const { id } = await params;
  const parsed = workSheetPayloadSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Données invalides." }, { status: 400 });

  const data = parsed.data;
  const catalog = await getActiveCatalog();
  const materials = new Map(catalog.flatMap((category) =>
    category.materials.map((material) => [material.id, { category, material }] as const),
  ));
  const reportText = data.reportFrozen ? data.reportText : generateWorkSheetReport(data, catalog);

  await prisma.$transaction(async (tx) => {
    await tx.workSheet.update({
      where: { id },
      data: {
        workDate: data.workDate ? new Date(`${data.workDate}T12:00:00Z`) : null,
        client: data.client,
        company: data.company,
        installer: data.installer,
        eventId: data.eventId || null,
        mainInstallations: data.mainInstallations,
        otherMaterials: data.otherMaterials,
        reportText,
        reportFrozen: data.reportFrozen,
        items: { deleteMany: {} },
      },
    });
    for (const [position, selection] of data.selections.filter((item) => item.selected).entries()) {
      const found = materials.get(selection.materialId);
      if (!found) continue;
      const variant = found.material.variants.find((item) => item.id === selection.variantId);
      await tx.workSheetItem.create({
        data: {
          workSheetId: id,
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
          supplier: selection.supplier,
          installed: selection.installed,
          position,
        },
      });
    }
    await tx.auditLog.create({
      data: { userId: user.id, action: "WORKSHEET_UPDATE", entityType: "WorkSheet", entityId: id },
    });
  });
  return NextResponse.json({ id });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const { id } = await params;
  await prisma.$transaction([
    prisma.workSheet.update({ where: { id }, data: { archivedAt: new Date() } }),
    prisma.auditLog.create({
      data: { userId: user.id, action: "WORKSHEET_ARCHIVE", entityType: "WorkSheet", entityId: id },
    }),
  ]);
  return NextResponse.json({ ok: true });
}
