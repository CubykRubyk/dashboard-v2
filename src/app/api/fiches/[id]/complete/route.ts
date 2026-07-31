import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { finalizationErrors } from "@/lib/worksheets/validation";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const { id } = await params;
  const workSheet = await prisma.workSheet.findFirst({
    where: { id, archivedAt: null },
    include: { items: true, tags: true },
  });
  if (!workSheet) return NextResponse.json({ error: "Fiche introuvable." }, { status: 404 });
  const errors = finalizationErrors(workSheet);
  if (errors.length) {
    return NextResponse.json(
      { error: "La fiche est incomplète.", errors },
      { status: 422 },
    );
  }
  await prisma.$transaction([
    prisma.workSheet.update({ where: { id }, data: { status: "COMPLETED" } }),
    prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "WORKSHEET_COMPLETE",
        entityType: "WorkSheet",
        entityId: id,
      },
    }),
  ]);
  return NextResponse.json({ ok: true, message: "Fiche marquée comme terminée." });
}
