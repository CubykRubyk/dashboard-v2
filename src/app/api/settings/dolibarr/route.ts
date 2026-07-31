import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { encryptSecret } from "@/lib/dolibarr/crypto";
import { normalizeDolibarrUrl } from "@/lib/dolibarr/client";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const settings = await prisma.appSettings.findUnique({ where: { id: 1 } });
  return NextResponse.json({
    dolibarrUrl: settings?.dolibarrUrl || "",
    configured: Boolean(settings?.dolibarrUrl && settings.dolibarrApiKeyEncrypted),
  });
}

export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Droits administrateur requis." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Le contenu JSON n’est pas valide." }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Données invalides." }, { status: 400 });
  }
  const input = body as { dolibarrUrl?: unknown; dolibarrApiKey?: unknown };
  if (typeof input.dolibarrUrl !== "string" || typeof input.dolibarrApiKey !== "string") {
    return NextResponse.json({ error: "URL et clé API requises." }, { status: 400 });
  }

  let dolibarrUrl: string;
  try {
    dolibarrUrl = normalizeDolibarrUrl(input.dolibarrUrl);
  } catch {
    return NextResponse.json({ error: "L’URL Dolibarr n’est pas valide." }, { status: 400 });
  }
  const apiKey = input.dolibarrApiKey.trim();
  const existing = await prisma.appSettings.findUnique({ where: { id: 1 } });
  if (!apiKey && !existing?.dolibarrApiKeyEncrypted) {
    return NextResponse.json({ error: "La clé API est requise." }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.appSettings.upsert({
      where: { id: 1 },
      update: {
        dolibarrUrl,
        ...(apiKey ? { dolibarrApiKeyEncrypted: encryptSecret(apiKey) } : {}),
      },
      create: {
        id: 1,
        dolibarrUrl,
        dolibarrApiKeyEncrypted: encryptSecret(apiKey),
      },
    }),
    prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "DOLIBARR_SETTINGS_UPDATE",
        entityType: "AppSettings",
        entityId: "1",
      },
    }),
  ]);

  return NextResponse.json({ ok: true, dolibarrUrl, configured: true });
}
