import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { canManageNotifications } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/session";
import { encryptSecret } from "@/lib/dolibarr/crypto";
import { prisma } from "@/lib/prisma";
import { invalidateRuntimeConfig } from "@/lib/settings/runtime-config";

/** État de la configuration. **Ne renvoie jamais un secret** — seulement s'il est renseigné. */
export async function GET() {
  const user = await getSession();
  if (!canManageNotifications(user?.role)) {
    return NextResponse.json({ error: "Droits administrateur requis." }, { status: 403 });
  }

  const [settings, devices] = await Promise.all([
    prisma.appSettings.findUnique({
      where: { id: 1 },
      select: {
        vapidPublicKey: true,
        vapidPrivateKeyEncrypted: true,
        vapidSubject: true,
        resendApiKeyEncrypted: true,
        emailFrom: true,
      },
    }),
    prisma.pushSubscription.count(),
  ]);

  return NextResponse.json({
    push: {
      configured: Boolean(settings?.vapidPublicKey && settings.vapidPrivateKeyEncrypted),
      // La clé publique n'est pas un secret : le navigateur en a besoin pour s'abonner.
      publicKey: settings?.vapidPublicKey || "",
      subject: settings?.vapidSubject || "",
    },
    email: {
      configured: Boolean(settings?.resendApiKeyEncrypted && settings.emailFrom),
      from: settings?.emailFrom || "",
    },
    devices,
  });
}

const saveSchema = z.object({
  // Champs vides = « conserver la valeur actuelle » (même convention que la clé API Dolibarr).
  vapidPublicKey: z.string().trim().max(255).optional().default(""),
  vapidPrivateKey: z.string().trim().max(255).optional().default(""),
  vapidSubject: z
    .string()
    .trim()
    .max(200)
    .refine((value) => value === "" || value.startsWith("mailto:") || value.startsWith("https://"), {
      message: "Le contact VAPID doit être un « mailto: » ou une URL https.",
    })
    .optional()
    .default(""),
  resendApiKey: z.string().trim().max(255).optional().default(""),
  emailFrom: z.string().trim().max(200).optional().default(""),
});

export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!canManageNotifications(user?.role)) {
    return NextResponse.json({ error: "Droits administrateur requis." }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Le contenu JSON n’est pas valide." }, { status: 400 });
  }
  const parsed = saveSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Données invalides." },
      { status: 400 },
    );
  }
  const input = parsed.data;

  // Une paire VAPID incomplète ne permet aucun envoi : autant le dire tout de suite plutôt que de
  // laisser une configuration qui semble enregistrée mais reste inopérante.
  const existing = await prisma.appSettings.findUnique({
    where: { id: 1 },
    select: { vapidPublicKey: true, vapidPrivateKeyEncrypted: true },
  });
  const willHavePublic = input.vapidPublicKey || existing?.vapidPublicKey;
  const willHavePrivate = input.vapidPrivateKey || existing?.vapidPrivateKeyEncrypted;
  if (Boolean(willHavePublic) !== Boolean(willHavePrivate)) {
    return NextResponse.json(
      { error: "Les clés push vont par paire : renseignez la publique et la privée." },
      { status: 400 },
    );
  }

  const data = {
    ...(input.vapidPublicKey ? { vapidPublicKey: input.vapidPublicKey } : {}),
    ...(input.vapidPrivateKey
      ? { vapidPrivateKeyEncrypted: encryptSecret(input.vapidPrivateKey) }
      : {}),
    ...(input.vapidSubject ? { vapidSubject: input.vapidSubject } : {}),
    ...(input.resendApiKey ? { resendApiKeyEncrypted: encryptSecret(input.resendApiKey) } : {}),
    // L'expéditeur peut légitimement être effacé, contrairement aux clés : on accepte la valeur
    // telle quelle dès qu'elle est fournie dans la requête.
    ...(payload && typeof payload === "object" && "emailFrom" in payload
      ? { emailFrom: input.emailFrom }
      : {}),
  };

  await prisma.$transaction([
    prisma.appSettings.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } }),
    prisma.auditLog.create({
      data: {
        userId: user!.id,
        action: "NOTIFICATION_SETTINGS_UPDATE",
        entityType: "AppSettings",
        entityId: "1",
        // Jamais la valeur des secrets — seulement lesquels ont changé (règle appliquée aux
        // mots de passe depuis toujours).
        metadata: {
          vapidUpdated: Boolean(input.vapidPublicKey || input.vapidPrivateKey),
          emailUpdated: Boolean(input.resendApiKey || input.emailFrom),
        },
      },
    }),
  ]);
  invalidateRuntimeConfig();

  return NextResponse.json({ ok: true });
}
