import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth/session";
import { getVapidPublicKey } from "@/lib/settings/runtime-config";
import { prisma } from "@/lib/prisma";

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({
    p256dh: z.string().min(1).max(255),
    auth: z.string().min(1).max(255),
  }),
});

/** Expose la clé publique VAPID au client, qui en a besoin pour s'abonner. */
export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const publicKey = await getVapidPublicKey();
  return NextResponse.json({ configured: Boolean(publicKey), publicKey });
}

export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  const parsed = subscriptionSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Abonnement invalide." }, { status: 400 });
  }
  const { endpoint, keys } = parsed.data;

  // `endpoint` est unique : un même appareil qui se réabonne (ou change de compte) met à jour la
  // ligne existante au lieu d'en créer une seconde, qui recevrait les notifications en double.
  const userAgent = request.headers.get("user-agent")?.slice(0, 255) ?? "";
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { userId: user.id, p256dh: keys.p256dh, auth: keys.auth, userAgent },
    create: { userId: user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent },
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const endpoint = request.nextUrl.searchParams.get("endpoint");
  if (!endpoint) return NextResponse.json({ error: "Endpoint manquant." }, { status: 400 });

  // Filtré sur l'utilisateur : personne ne peut désabonner l'appareil d'un autre.
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: user.id } });
  return NextResponse.json({ ok: true });
}
