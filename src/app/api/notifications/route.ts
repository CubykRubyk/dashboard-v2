import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { canViewSav } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";

const FEED_LIMIT = 15;

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  // Notifications **persistées** (SAV créé, fiche envoyée…) : contrairement aux indicateurs
  // recalculés ci-dessous, ce sont des événements datés, propres à l'utilisateur, et qui
  // conservent leur état lu/non lu. Servies même sans `canViewSav` : leur contenu dépend de ce
  // qui a été notifié, pas d'un droit de lecture SAV.
  const feed = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: FEED_LIMIT,
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      entityType: true,
      entityId: true,
      readAt: true,
      createdAt: true,
    },
  });
  const unreadCount = await prisma.notification.count({
    where: { userId: user.id, readAt: null },
  });

  if (!canViewSav(user.role)) {
    return NextResponse.json({
      feed,
      unreadCount,
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
    feed,
    unreadCount,
    unassignedSav,
    suggestionsActive,
    dolibarrLastSyncError: settings?.dolibarrLastSyncError ?? null,
  });
}

/** Marque comme lues les notifications de l'utilisateur (à l'ouverture du panneau). */
export async function POST() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const { count } = await prisma.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  return NextResponse.json({ marked: count });
}
