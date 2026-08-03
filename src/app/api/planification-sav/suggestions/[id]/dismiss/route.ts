import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { canManageSav } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  if (!user || !canManageSav(user.role)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const { id } = await params;

  const existing = await prisma.savProximitySuggestion.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Suggestion introuvable." }, { status: 404 });
  }

  await prisma.savProximitySuggestion.update({
    where: { id },
    data: { dismissed: true, dismissedAt: new Date(), dismissedById: user.id },
  });
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "SAV_PROXIMITY_SUGGESTION_DISMISS",
      entityType: "SavProximitySuggestion",
      entityId: id,
      metadata: { savTicketId: existing.savTicketId, interventionId: existing.interventionId },
    },
  });

  return NextResponse.json({ success: true });
}
