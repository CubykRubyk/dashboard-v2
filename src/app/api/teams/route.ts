import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { canManageTeams, canViewSav } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  name: z.string().min(1).max(80),
});

export async function GET() {
  const user = await getSession();
  if (!user || !canViewSav(user.role)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const teams = await prisma.team.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  return NextResponse.json({ teams });
}

export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user || !canManageTeams(user.role)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Le contenu JSON n'est pas valide." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides." }, { status: 400 });
  }

  const team = await prisma.team.create({ data: { name: parsed.data.name } });
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "TEAM_CREATE",
      entityType: "Team",
      entityId: team.id,
      metadata: { name: team.name },
    },
  });
  return NextResponse.json({ team }, { status: 201 });
}
