import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { canManageTeams } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  active: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  if (!user || !canManageTeams(user.role)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const { id } = await params;

  const existing = await prisma.team.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    return NextResponse.json({ error: "Équipe introuvable." }, { status: 404 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Le contenu JSON n'est pas valide." }, { status: 400 });
  }
  const parsed = updateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides." }, { status: 400 });
  }

  const team = await prisma.team.update({ where: { id }, data: parsed.data });
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "TEAM_UPDATE",
      entityType: "Team",
      entityId: team.id,
      metadata: { name: team.name, active: team.active },
    },
  });
  return NextResponse.json({ team });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  if (!user || !canManageTeams(user.role)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const { id } = await params;

  const team = await prisma.team.findUnique({ where: { id } });
  if (!team) {
    return NextResponse.json({ error: "Équipe introuvable." }, { status: 404 });
  }
  const usageCount = await prisma.savTicket.count({ where: { teamId: id } });
  if (usageCount > 0) {
    return NextResponse.json(
      { error: "Cette équipe est déjà assignée à des bilets SAV et ne peut pas être supprimée." },
      { status: 409 },
    );
  }

  await prisma.team.delete({ where: { id } });
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "TEAM_DELETE",
      entityType: "Team",
      entityId: id,
      metadata: { name: team.name },
    },
  });
  return NextResponse.json({ success: true });
}
