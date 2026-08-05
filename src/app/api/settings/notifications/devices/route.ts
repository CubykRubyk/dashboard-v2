import { NextRequest, NextResponse } from "next/server";

import { canManageNotifications } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/session";
import { describeDevice } from "@/lib/notifications/device-label";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getSession();
  if (!canManageNotifications(user?.role)) {
    return NextResponse.json({ error: "Droits administrateur requis." }, { status: 403 });
  }

  const subscriptions = await prisma.pushSubscription.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      userAgent: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
    },
  });

  return NextResponse.json({
    devices: subscriptions.map((subscription) => ({
      id: subscription.id,
      device: describeDevice(subscription.userAgent),
      user: subscription.user.name,
      email: subscription.user.email,
      createdAt: subscription.createdAt.toISOString(),
    })),
  });
}

/** Déconnecte un appareil. L'utilisateur devra réactiver les notifications pour le réabonner. */
export async function DELETE(request: NextRequest) {
  const user = await getSession();
  if (!canManageNotifications(user?.role)) {
    return NextResponse.json({ error: "Droits administrateur requis." }, { status: 403 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Identifiant manquant." }, { status: 400 });

  const deleted = await prisma.pushSubscription.deleteMany({ where: { id } });
  if (deleted.count === 0) {
    return NextResponse.json({ error: "Appareil introuvable." }, { status: 404 });
  }

  await prisma.auditLog
    .create({
      data: {
        userId: user!.id,
        action: "NOTIFICATION_DEVICE_REVOKE",
        entityType: "PushSubscription",
        entityId: id,
      },
    })
    .catch(() => undefined);

  return NextResponse.json({ ok: true });
}
