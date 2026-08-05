/**
 * Vérifie l'infrastructure hors ligne (service worker) et les notifications push.
 *
 *   npx tsx --env-file=.env scripts/test-push-offline.ts
 *
 * Ce qui est vérifiable sans navigateur : les fichiers servis, la route d'abonnement et son
 * cloisonnement, le nettoyage des abonnements morts, et le fait qu'une notification métier
 * déclenche bien une tentative d'envoi push. Ce qui ne l'est pas : le comportement réel du
 * service worker et l'affichage d'une notification système — voir la note finale.
 */
import { hash } from "bcryptjs";
import { SignJWT } from "jose";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3005";

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
  await prisma.pushSubscription.deleteMany({
    where: { endpoint: { contains: "zz-push-test" } },
  });
  await prisma.user.deleteMany({ where: { email: { startsWith: "zz-push-test" } } });
}

function fakeSubscription(suffix: string) {
  return {
    endpoint: `https://fcm.googleapis.com/fcm/send/zz-push-test-${suffix}`,
    keys: {
      // Clés au bon format (longueurs réelles) : la route doit les accepter telles quelles.
      p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM",
      auth: "tBHItJI5svbpez7KI4CCXg",
    },
  };
}

async function main() {
  await cleanup();

  const passwordHash = await hash("MotDePasseTest2026!", 12);
  const [alice, bob] = await Promise.all([
    prisma.user.create({
      data: { email: "zz-push-test-a@test.local", name: "Alice Test", passwordHash, role: "ADMIN" },
    }),
    prisma.user.create({
      data: { email: "zz-push-test-b@test.local", name: "Bob Test", passwordHash, role: "OPERATOR" },
    }),
  ]);

  try {
    const aliceCookie = await cookieFor({ ...alice, role: "ADMIN" });
    const bobCookie = await cookieFor({ ...bob, role: "OPERATOR" });

    // 1) Fichiers de l'infrastructure hors ligne réellement servis.
    const sw = await fetch(`${BASE_URL}/sw.js`);
    const swBody = await sw.text();
    check("GET /sw.js → 200", sw.status === 200, sw.status);
    check("Le service worker gère les navigations", swBody.includes("networkFirstPage"));
    check("Le service worker gère le push", swBody.includes('addEventListener("push"'));
    check("Il ne met en cache que les GET", swBody.includes('request.method !== "GET"'));

    const offline = await fetch(`${BASE_URL}/offline.html`);
    check("GET /offline.html → 200", offline.status === 200, offline.status);

    const manifest = await fetch(`${BASE_URL}/manifest.json`).then((r) => r.json());
    check("Le manifest démarre sur /mobile", manifest.start_url === "/mobile", manifest.start_url);

    // 2) Route d'abonnement : clé publique exposée aux sessions seulement.
    const anonymous = await fetch(`${BASE_URL}/api/notifications/subscribe`);
    check("Clé VAPID inaccessible sans session → 401", anonymous.status === 401, anonymous.status);

    const config = await fetch(`${BASE_URL}/api/notifications/subscribe`, {
      headers: { cookie: aliceCookie },
    }).then((r) => r.json());
    check("VAPID est configuré", config.configured === true, config);
    check("La clé publique est renvoyée", typeof config.publicKey === "string" && config.publicKey.length > 20);

    // 3) Abonnement.
    const subscription = fakeSubscription("alice");
    const subscribed = await fetch(`${BASE_URL}/api/notifications/subscribe`, {
      method: "POST",
      headers: { cookie: aliceCookie, "Content-Type": "application/json" },
      body: JSON.stringify(subscription),
    });
    check("Abonnement enregistré → 201", subscribed.status === 201, subscribed.status);
    check("L’abonnement est en base",
      (await prisma.pushSubscription.count({ where: { userId: alice.id } })) === 1);

    // Un réabonnement du même appareil met à jour, il ne duplique pas (sinon double notification).
    await fetch(`${BASE_URL}/api/notifications/subscribe`, {
      method: "POST",
      headers: { cookie: aliceCookie, "Content-Type": "application/json" },
      body: JSON.stringify(subscription),
    });
    check("Un réabonnement ne crée pas de doublon",
      (await prisma.pushSubscription.count({ where: { userId: alice.id } })) === 1);

    const invalid = await fetch(`${BASE_URL}/api/notifications/subscribe`, {
      method: "POST",
      headers: { cookie: aliceCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: "pas-une-url" }),
    });
    check("Abonnement malformé → 400", invalid.status === 400, invalid.status);

    // 4) Personne ne peut désabonner l'appareil d'un autre.
    const stolen = await fetch(
      `${BASE_URL}/api/notifications/subscribe?endpoint=${encodeURIComponent(subscription.endpoint)}`,
      { method: "DELETE", headers: { cookie: bobCookie } },
    );
    check("Désabonnement par un autre utilisateur → sans effet",
      stolen.ok && (await prisma.pushSubscription.count({ where: { userId: alice.id } })) === 1);

    // 5) Une notification métier tente un envoi push et nettoie l'abonnement mort.
    // L'endpoint est fictif : le service de push répond 404/410, ce que `pushToUser` traite en
    // supprimant l'abonnement — c'est précisément ce nettoyage qu'on vérifie ici.
    const before = await prisma.notification.count({ where: { userId: alice.id } });
    const savCreated = await fetch(`${BASE_URL}/api/sav`, {
      method: "POST",
      headers: { cookie: aliceCookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "ZZ Push Test",
        company: "ZZ Push Test",
        contact: "Testeur",
      }),
    });
    check("SAV créé (déclencheur de notification) → 201", savCreated.status === 201, savCreated.status);

    const after = await prisma.notification.count({ where: { userId: alice.id } });
    check("Une notification persistée a été créée", after > before, { before, after });

    const remaining = await prisma.pushSubscription.count({ where: { userId: alice.id } });
    check("L’abonnement injoignable a été nettoyé automatiquement", remaining === 0, remaining);

    // Nettoyage du SAV de test.
    const created = await savCreated.json().catch(() => ({}));
    if (created?.ticket?.id) {
      await prisma.notification.deleteMany({ where: { entityId: created.ticket.id } });
      await prisma.savTicket.deleteMany({ where: { id: created.ticket.id } });
    }

    // 6) Désabonnement par son propriétaire.
    await fetch(`${BASE_URL}/api/notifications/subscribe`, {
      method: "POST",
      headers: { cookie: aliceCookie, "Content-Type": "application/json" },
      body: JSON.stringify(fakeSubscription("alice-2")),
    });
    const removed = await fetch(
      `${BASE_URL}/api/notifications/subscribe?endpoint=${encodeURIComponent(fakeSubscription("alice-2").endpoint)}`,
      { method: "DELETE", headers: { cookie: aliceCookie } },
    );
    check("Désabonnement par son propriétaire → 200", removed.ok);
    check("L’abonnement a disparu",
      (await prisma.pushSubscription.count({ where: { userId: alice.id } })) === 0);
  } finally {
    await cleanup();
    await prisma.savTicket.deleteMany({ where: { company: "ZZ Push Test" } });
    console.log("\n· Comptes, abonnements et SAV de test supprimés.");
  }

  console.log(`\n${failures === 0 ? "Tous les tests sont passés." : `${failures} test(s) en échec.`}`);
  console.log(
    "\nNon couvert ici (impossible sans navigateur réel) : le service worker en fonctionnement\n"
    + "(mise en cache, mode avion) et l'affichage d'une notification système. À tester sur un\n"
    + "build de production, PWA installée sur l'écran d'accueil — sur iOS c'est même obligatoire.",
  );
  await prisma.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error(error);
  await cleanup().catch(() => undefined);
  await prisma.$disconnect();
  process.exit(1);
});
