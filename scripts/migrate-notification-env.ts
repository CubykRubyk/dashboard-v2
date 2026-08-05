/**
 * Reprend les clés notifications encore présentes dans l'environnement et les enregistre en base.
 *
 *   npx tsx --env-file=.env scripts/migrate-notification-env.ts
 *
 * À lancer **une fois** sur chaque environnement déjà configuré via `.env` (dont la production),
 * l'application étant démarrée. La base devient ensuite la seule source : les variables
 * `VAPID_*` / `RESEND_API_KEY` / `EMAIL_FROM` peuvent être retirées.
 *
 * Passe par la route de sauvegarde plutôt que d'écrire en base directement : le chiffrement vit
 * dans un module `server-only`, et cela garantit que la reprise emprunte exactement le même
 * chemin qu'une saisie depuis les Paramètres (mêmes validations, même audit).
 *
 * Prudent : ne remplace jamais une valeur déjà enregistrée en base — sans quoi un second passage
 * écraserait une clé réglée entre-temps depuis l'interface.
 */
import { SignJWT } from "jose";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3005";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN", active: true } });
  if (!admin) throw new Error("Aucun compte ADMIN actif en base.");
  const token = await new SignJWT({
    user: { id: admin.id, email: admin.email, name: admin.name, role: "ADMIN" },
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
    .sign(new TextEncoder().encode(process.env.AUTH_SECRET!));
  const cookie = `dashboard_session=${token}`;

  const current = await prisma.appSettings.findUnique({
    where: { id: 1 },
    select: { vapidPublicKey: true, resendApiKeyEncrypted: true },
  });

  const vapidPublic = process.env.VAPID_PUBLIC_KEY?.trim();
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY?.trim();
  const vapidSubject = process.env.VAPID_SUBJECT?.trim();
  const resendKey = process.env.RESEND_API_KEY?.trim();
  const emailFrom = process.env.EMAIL_FROM?.trim();

  const body: Record<string, string> = {};
  const done: string[] = [];
  const skipped: string[] = [];

  if (vapidPublic && vapidPrivate) {
    if (current?.vapidPublicKey) skipped.push("clés push (déjà en base)");
    else {
      body.vapidPublicKey = vapidPublic;
      body.vapidPrivateKey = vapidPrivate;
      if (vapidSubject) body.vapidSubject = vapidSubject;
      done.push("clés push");
    }
  }

  if (resendKey && emailFrom) {
    if (current?.resendApiKeyEncrypted) skipped.push("e-mail (déjà en base)");
    else {
      body.resendApiKey = resendKey;
      body.emailFrom = emailFrom;
      done.push("configuration e-mail");
    }
  }

  if (Object.keys(body).length === 0) {
    console.log("Rien à reprendre.");
    if (skipped.length > 0) console.log(`  ignoré : ${skipped.join(", ")}`);
    if (!vapidPublic && !resendKey) {
      console.log("  (aucune variable d’environnement notifications trouvée)");
    }
    await prisma.$disconnect();
    return;
  }

  const response = await fetch(`${BASE_URL}/api/settings/notifications`, {
    method: "POST",
    headers: { cookie, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    console.error("Échec :", await response.json().catch(() => ({})));
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log(`Repris en base : ${done.join(", ")}.`);
  if (skipped.length > 0) console.log(`Ignoré : ${skipped.join(", ")}.`);
  console.log("\nLes variables d’environnement correspondantes ne sont plus utilisées.");

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
