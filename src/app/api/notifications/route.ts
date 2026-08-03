import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { canViewSav } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  if (!canViewSav(user.role)) {
    return NextResponse.json({
      unassignedSav: [],
      suggestionsActive: 0,
      dolibarrLastSyncError: null,
    });
  }

  const [unassignedSav, suggestionsActive, settings] = await Promise.all([
    prisma.savTicket.findMany({
      where: { status: "OUVERT", teamId: null },
      select: { id: true, reference: true, title: true, company: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.savProximitySuggestion.count({ where: { dismissed: false } }),
    prisma.appSettings.findUnique({ where: { id: 1 }, select: { dolibarrLastSyncError: true } }),
  ]);

  return NextResponse.json({
    unassignedSav,
    suggestionsActive,
    dolibarrLastSyncError: settings?.dolibarrLastSyncError ?? null,
  });
}
