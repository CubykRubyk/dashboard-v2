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

  const existing = await prisma.workSheet.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Fiche chantier introuvable." }, { status: 404 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Le contenu JSON n’est pas valide." }, { status: 400 });
  }
  const parsed = workSheetPayloadSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Données invalides." }, { status: 400 });

  const data = parsed.data;
  const catalog = await getActiveCatalog();
  const materials = new Map(catalog.flatMap((category) =>
    category.materials.map((material) => [material.id, { category, material }] as const),
  ));
  const invalidSelection = data.selections
    .filter((selection) => selection.selected)
    .some((selection) => {
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
  const reportText = data.reportFrozen ? data.reportText : generateWorkSheetReport(data, catalog);
  const validTags = await prisma.tag.findMany({
    where: { id: { in: data.tagIds } },
    select: { id: true },
  });

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
        tags: {
          deleteMany: {},
          create: validTags.map((tag) => ({ tagId: tag.id })),
        },
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
          supplier: found.material.allowSupplier ? selection.supplier : "INTERNAL",
          installed: found.material.allowNotInstalled ? selection.installed : true,
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
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const { id } = await params;

  const existing = await prisma.workSheet.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Fiche chantier introuvable." }, { status: 404 });
  }

  if (request.nextUrl.searchParams.get("permanent") === "true") {
    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Droits administrateur requis." }, { status: 403 });
    }
    await prisma.$transaction([
      prisma.workSheet.delete({ where: { id } }),
      prisma.auditLog.create({
        data: {
          userId: user.id,
          action: "WORKSHEET_DELETE_PERMANENT",
          entityType: "WorkSheet",
          entityId: id,
        },
      }),
    ]);
    return NextResponse.json({ ok: true, deleted: true });
  }

  await prisma.$transaction([
    prisma.workSheet.update({ where: { id }, data: { archivedAt: new Date() } }),
    prisma.auditLog.create({
      data: { userId: user.id, action: "WORKSHEET_ARCHIVE", entityType: "WorkSheet", entityId: id },
    }),
  ]);
  return NextResponse.json({ ok: true });
}
