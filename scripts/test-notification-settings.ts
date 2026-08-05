/**
 * Vérifie le tab « Notifications » des paramètres : cloisonnement, enregistrement des clés,
 * génération VAPID, tests d'envoi et gestion des appareils.
 *
 *   npx tsx --env-file=.env scripts/test-notification-settings.ts
 *
 * ⚠️ Ce script **regénère les clés VAPID** pendant le test, ce qui déconnecte les appareils
 * abonnés — comme le ferait le bouton correspondant. Il restaure la configuration d'origine à la
 * fin (clés comprises), mais les abonnements supprimés entre-temps ne sont pas recréés : à ne pas
 * lancer sur un environnement où des techniciens sont déjà abonnés.
 */
import { hash } from "bcryptjs";
import { SignJWT } from "jose";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3005";
const TEST_EMAIL = "zz-notif-settings@test.local";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

let failures = 0;
function check(label: string, condition: boolean, detail?: unknown) {
  if (condition) console.log(`✓ ${label}`);
  else {
    failures += 1;
    console.error(`✗ ${label}`, detail ?? "");
  }
}

async function cookieFor(user: { id: string; email: string; name: string; role: string }) {
  const token = await new SignJWT({ user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
    .sign(new TextEncoder().encode(process.env.AUTH_SECRET!));
  return `dashboard_session=${token}`;
}

async function cleanup() {
  await prisma.pushSubscription.deleteMany({ where: { endpoint: { contains: "zz-notif-settings" } } });
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
}

async function main() {
  await cleanup();

  const admin = await prisma.user.findFirst({ where: { role: "ADMIN", active: true } });
  if (!admin) throw new Error("Aucun compte ADMIN actif.");
  const adminCookie = await cookieFor({ ...admin, role: "ADMIN" });

  const operator = await prisma.user.create({
    data: {
      email: TEST_EMAIL,
      name: "Opérateur Test",
      passwordHash: await hash("MotDePasseTest2026!", 12),
      role: "OPERATOR",
    },
  });
  const operatorCookie = await cookieFor({ ...operator, role: "OPERATOR" });

  // Sauvegarde de la configuration réelle, restaurée à la fin.
  const original = await prisma.appSettings.findUnique({
    where: { id: 1 },
    select: {
      vapidPublicKey: true,
      vapidPrivateKeyEncrypted: true,
      vapidSubject: true,
      resendApiKeyEncrypted: true,
      emailFrom: true,
    },
  });

  try {
    // 1) Cloisonnement : ADMIN uniquement, sur toutes les routes.
    const anonymous = await fetch(`${BASE_URL}/api/settings/notifications`);
    check("GET sans session → 403", anonymous.status === 403, anonymous.status);

    for (const [label, path, method] of [
      ["état", "", "GET"],
      ["enregistrement", "", "POST"],
      ["génération de clés", "/generate-vapid", "POST"],
      ["test push", "/test-push", "POST"],
      ["test e-mail", "/test-email", "POST"],
      ["appareils", "/devices", "GET"],
    ] as const) {
      const response = await fetch(`${BASE_URL}/api/settings/notifications${path}`, {
        method,
        headers: { cookie: operatorCookie, "Content-Type": "application/json" },
        ...(method === "POST" ? { body: "{}" } : {}),
      });
      check(`OPERATOR refusé sur ${label} → 403`, response.status === 403, response.status);
    }

    // 2) L'état ne divulgue jamais de secret.
    const stateResponse = await fetch(`${BASE_URL}/api/settings/notifications`, {
      headers: { cookie: adminCookie },
    });
    const rawBody = await stateResponse.text();
    check("GET en ADMIN → 200", stateResponse.status === 200, stateResponse.status);
    check("Aucune clé privée dans la réponse",
      !rawBody.includes("vapidPrivateKey") && !rawBody.includes("resendApiKey"), rawBody.slice(0, 200));
    const state = JSON.parse(rawBody);
    check("La clé publique est exposée (nécessaire au navigateur)",
      typeof state.push.publicKey === "string");

    // 3) Enregistrement : un champ vide conserve la valeur existante.
    const before = await prisma.appSettings.findUnique({
      where: { id: 1 },
      select: { vapidPublicKey: true, vapidPrivateKeyEncrypted: true },
    });
    const savedSubject = await fetch(`${BASE_URL}/api/settings/notifications`, {
      method: "POST",
      headers: { cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ vapidSubject: "mailto:test@exemple.fr" }),
    });
    check("Enregistrement du contact VAPID → 200", savedSubject.status === 200);
    const afterSubject = await prisma.appSettings.findUnique({
      where: { id: 1 },
      select: { vapidPublicKey: true, vapidPrivateKeyEncrypted: true, vapidSubject: true },
    });
    check("Le contact est enregistré", afterSubject?.vapidSubject === "mailto:test@exemple.fr");
    check("Les clés existantes ne sont pas écrasées par des champs vides",
      afterSubject?.vapidPublicKey === before?.vapidPublicKey
      && afterSubject?.vapidPrivateKeyEncrypted === before?.vapidPrivateKeyEncrypted);

    // 4) Validations.
    const badSubject = await fetch(`${BASE_URL}/api/settings/notifications`, {
      method: "POST",
      headers: { cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ vapidSubject: "pas-un-contact" }),
    });
    check("Contact VAPID invalide → 400", badSubject.status === 400, badSubject.status);

    const halfPair = await fetch(`${BASE_URL}/api/settings/notifications`, {
      method: "POST",
      headers: { cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ vapidPublicKey: "seulement-la-publique" }),
    });
    // La paire est déjà complète en base, donc fournir la seule publique reste cohérent.
    check("Une paire déjà complète accepte une publique seule", halfPair.status === 200, halfPair.status);

    // 5) Test push sans appareil abonné : message explicite, pas un 500.
    await prisma.pushSubscription.deleteMany({ where: { userId: admin.id } });
    const noDevice = await fetch(`${BASE_URL}/api/settings/notifications/test-push`, {
      method: "POST",
      headers: { cookie: adminCookie },
    });
    const noDeviceBody = await noDevice.json();
    check("Test push sans appareil → 409 explicite", noDevice.status === 409, noDevice.status);
    check("Le message explique quoi faire",
      typeof noDeviceBody.error === "string" && noDeviceBody.error.includes("écran d’accueil"),
      noDeviceBody);

    // 6) Génération de clés : nouvelle paire, abonnements périmés supprimés.
    await prisma.pushSubscription.create({
      data: {
        userId: admin.id,
        endpoint: "https://fcm.googleapis.com/fcm/send/zz-notif-settings-1",
        p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM",
        auth: "tBHItJI5svbpez7KI4CCXg",
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1",
      },
    });

    const devicesResponse = await fetch(`${BASE_URL}/api/settings/notifications/devices`, {
      headers: { cookie: adminCookie },
    });
    const devicesBody = await devicesResponse.json();
    check("La liste des appareils est servie", devicesResponse.status === 200);
    check("L’appareil est décrit lisiblement",
      devicesBody.devices?.[0]?.device === "iPhone · Safari", devicesBody.devices?.[0]?.device);

    const previousKey = (await prisma.appSettings.findUnique({
      where: { id: 1 }, select: { vapidPublicKey: true },
    }))?.vapidPublicKey;

    const generated = await fetch(`${BASE_URL}/api/settings/notifications/generate-vapid`, {
      method: "POST",
      headers: { cookie: adminCookie },
    });
    const generatedBody = await generated.json();
    check("Génération de clés → 200", generated.status === 200, generatedBody);
    check("Une nouvelle clé publique est produite",
      typeof generatedBody.publicKey === "string" && generatedBody.publicKey !== previousKey);
    check("Le nombre d’appareils déconnectés est renvoyé",
      generatedBody.devicesDisconnected >= 1, generatedBody.devicesDisconnected);
    check("Les abonnements périmés sont supprimés",
      (await prisma.pushSubscription.count()) === 0);

    // La clé servie au navigateur doit refléter la nouvelle immédiatement (cache invalidé).
    const subscribeConfig = await fetch(`${BASE_URL}/api/notifications/subscribe`, {
      headers: { cookie: adminCookie },
    }).then((r) => r.json());
    check("La clé publique servie aux navigateurs est la nouvelle",
      subscribeConfig.publicKey === generatedBody.publicKey,
      { servie: subscribeConfig.publicKey?.slice(0, 20), attendue: generatedBody.publicKey?.slice(0, 20) });

    // 7) Test e-mail : sans configuration, erreur claire ; adresse invalide refusée.
    const emailConfigured = Boolean(original?.resendApiKeyEncrypted && original.emailFrom);
    const badAddress = await fetch(`${BASE_URL}/api/settings/notifications/test-email`, {
      method: "POST",
      headers: { cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ to: "pas-un-email" }),
    });
    check(
      emailConfigured ? "Adresse de test invalide → 400" : "E-mail non configuré → 409 explicite",
      emailConfigured ? badAddress.status === 400 : badAddress.status === 409,
      badAddress.status,
    );

    // 8) La page de paramètres se rend et affiche les trois sections.
    const page = await fetch(`${BASE_URL}/settings?tab=notifications`, { headers: { cookie: adminCookie } });
    const html = await page.text();
    check("GET /settings?tab=notifications → 200", page.status === 200, page.status);
    check("Section push rendue", html.includes("Notifications push"));
    check("Section e-mail rendue", html.includes("E-mails de suivi"));
    check("Section appareils rendue", html.includes("Appareils abonnés"));
    check("La clé privée n’apparaît nulle part dans la page",
      !html.includes("vapidPrivateKey") && !html.includes("resendApiKey"));

    // 9) Suppression d'un appareil inexistant.
    const missing = await fetch(`${BASE_URL}/api/settings/notifications/devices?id=inexistant`, {
      method: "DELETE",
      headers: { cookie: adminCookie },
    });
    check("Déconnexion d’un appareil inexistant → 404", missing.status === 404, missing.status);
  } finally {
    // Restauration de la configuration d'origine, écrite directement (la route ne reprend pas
    // une valeur déjà chiffrée).
    if (original) {
      await prisma.appSettings.update({ where: { id: 1 }, data: original }).catch(() => undefined);
    }
    await cleanup();
    console.log("\n· Configuration d’origine restaurée, comptes de test supprimés.");
  }

  console.log(`\n${failures === 0 ? "Tous les tests sont passés." : `${failures} test(s) en échec.`}`);
  await prisma.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error(error);
  await cleanup().catch(() => undefined);
  await prisma.$disconnect();
  process.exit(1);
});
