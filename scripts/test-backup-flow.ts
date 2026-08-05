/**
 * Test de bout en bout de la sauvegarde/restauration de la base.
 *
 *   npx tsx scripts/test-backup-flow.ts            # contre http://localhost:3005
 *   BASE_URL=http://localhost:3000 npx tsx …       # autre port
 *
 * Le test s'adapte à l'absence de `pg_dump` (cas du poste de dev sans client PostgreSQL) :
 * il vérifie alors que l'erreur remontée est explicite (503 « outil introuvable ») plutôt que
 * de faire semblant de réussir. Avec `pg_dump` disponible, il va jusqu'au fichier réel sur disque.
 */
import { SignJWT } from "jose";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3005";
const COOKIE_NAME = "dashboard_session";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET manquant ou trop court.");
  return new TextEncoder().encode(secret);
}

async function sessionCookie(user: { id: string; email: string; name: string; role: string }) {
  const token = await new SignJWT({ user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
    .sign(secretKey());
  return `${COOKIE_NAME}=${token}`;
}

let failures = 0;
function check(label: string, condition: boolean, detail?: unknown) {
  if (condition) {
    console.log(`✓ ${label}`);
  } else {
    failures += 1;
    console.error(`✗ ${label}`, detail ?? "");
  }
}

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN", active: true } });
  if (!admin) throw new Error("Aucun compte ADMIN actif en base.");
  const viewer = await prisma.user.findFirst({ where: { role: "VIEWER", active: true } });

  const adminCookie = await sessionCookie(admin);
  console.log(`Compte admin utilisé : ${admin.email}\n`);

  // 1) Sans session → 403 (et surtout pas 404 : la route doit exister)
  const anon = await fetch(`${BASE_URL}/api/settings/backup`);
  check("GET /api/settings/backup sans session → 403", anon.status === 403, anon.status);

  // 2) Session VIEWER → 403 (canManageBackups est ADMIN-only)
  if (viewer) {
    const viewerResponse = await fetch(`${BASE_URL}/api/settings/backup`, {
      headers: { cookie: await sessionCookie(viewer) },
    });
    check("GET /api/settings/backup en VIEWER → 403", viewerResponse.status === 403, viewerResponse.status);
  } else {
    console.log("· (pas de compte VIEWER en base, test de rôle ignoré)");
  }

  // 3) Session ADMIN → 200 + structure attendue
  const listed = await fetch(`${BASE_URL}/api/settings/backup`, { headers: { cookie: adminCookie } });
  const listing = await listed.json();
  check("GET /api/settings/backup en ADMIN → 200", listed.status === 200, listing);
  check("La réponse contient `backups` et `settings`", Array.isArray(listing.backups) && Boolean(listing.settings), listing);

  // 4) Planification : la route cron refuse un secret invalide…
  const badSecret = await fetch(`${BASE_URL}/api/cron/backup`, {
    method: "POST",
    headers: { "x-cron-secret": "mauvais-secret" },
  });
  check("POST /api/cron/backup avec mauvais secret → 401", badSecret.status === 401, badSecret.status);

  // …et accepte le bon (sans forcément déclencher : `not-due`/`disabled` sont des succès).
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const goodSecret = await fetch(`${BASE_URL}/api/cron/backup`, {
      method: "POST",
      headers: { "x-cron-secret": cronSecret },
    });
    const cronBody = await goodSecret.json();
    check(
      "POST /api/cron/backup avec bon secret → 200 (désactivée par défaut)",
      goodSecret.status === 200 && cronBody.ran === false,
      cronBody,
    );
  }

  // 5) Restauration : la confirmation est obligatoire, même en ADMIN.
  const noConfirmation = new FormData();
  noConfirmation.set("confirmation", "pas-le-bon-nom");
  noConfirmation.set("fileName", "dashboard-20260101-000000-deadbeef.dump");
  const refused = await fetch(`${BASE_URL}/api/settings/backup/restore`, {
    method: "POST",
    headers: { cookie: adminCookie },
    body: noConfirmation,
  });
  check("POST restore sans la bonne confirmation → 400", refused.status === 400, refused.status);

  // 6) Sauvegarde réelle — ou message d'erreur explicite si pg_dump est absent du poste.
  const created = await fetch(`${BASE_URL}/api/settings/backup`, {
    method: "POST",
    headers: { cookie: adminCookie },
  });
  const createdBody = await created.json();

  if (created.status === 503) {
    check(
      "pg_dump absent → 503 avec un message explicite (pas un 500 opaque)",
      typeof createdBody.error === "string" && createdBody.error.includes("introuvable"),
      createdBody,
    );
    console.log("\n⚠ pg_dump n’est pas installé sur ce poste : le dump réel n’a pas pu être testé.");
    console.log("  Installez le client PostgreSQL 17, ou testez dans le conteneur Docker.");
  } else {
    check("POST /api/settings/backup → 201", created.status === 201, createdBody);
    const fileName = createdBody?.backup?.fileName as string | undefined;
    check("Un nom de fichier est renvoyé", Boolean(fileName), createdBody);
    check("La taille du dump est non nulle", (createdBody?.backup?.sizeBytes ?? 0) > 0, createdBody);

    if (fileName) {
      // Le fichier doit apparaître dans la liste…
      const after = await fetch(`${BASE_URL}/api/settings/backup`, { headers: { cookie: adminCookie } });
      const afterBody = await after.json();
      check(
        "La sauvegarde apparaît dans la liste",
        afterBody.backups.some((backup: { fileName: string }) => backup.fileName === fileName),
        afterBody.backups,
      );

      // …et être téléchargeable, avec la signature d'un dump `pg_dump -Fc`.
      const download = await fetch(`${BASE_URL}/api/settings/backup/${fileName}`, {
        headers: { cookie: adminCookie },
      });
      const bytes = Buffer.from(await download.arrayBuffer());
      check("Téléchargement → 200", download.status === 200, download.status);
      check("Le fichier commence par la signature PGDMP", bytes.subarray(0, 5).toString() === "PGDMP", bytes.subarray(0, 8));

      // `backupLastRunAt` est mis à jour et l'erreur précédente effacée.
      const settings = await prisma.appSettings.findUnique({ where: { id: 1 } });
      check("backupLastRunAt est renseigné", Boolean(settings?.backupLastRunAt), settings);
      check("backupLastError est effacé après un succès", settings?.backupLastError === null, settings);

      // Trace d'audit.
      const audit = await prisma.auditLog.findFirst({
        where: { action: "DB_BACKUP_CREATE" },
        orderBy: { createdAt: "desc" },
      });
      check("Une ligne d’audit DB_BACKUP_CREATE existe", Boolean(audit), audit);

      // Traversée de chemin refusée.
      const traversal = await fetch(`${BASE_URL}/api/settings/backup/..%2F..%2F.env`, {
        headers: { cookie: adminCookie },
      });
      check("Tentative de traversée de chemin refusée (400/404)", traversal.status === 400 || traversal.status === 404, traversal.status);

      // Nettoyage : on ne laisse pas traîner le dump de test.
      const removed = await fetch(`${BASE_URL}/api/settings/backup/${fileName}`, {
        method: "DELETE",
        headers: { cookie: adminCookie },
      });
      check("Suppression de la sauvegarde de test → 200", removed.status === 200, removed.status);
    }
  }

  // 7) La page de paramètres rend bien l'onglet et ses commandes (pas seulement l'API).
  const page = await fetch(`${BASE_URL}/settings?tab=backup`, { headers: { cookie: adminCookie } });
  const html = await page.text();
  check("GET /settings?tab=backup → 200", page.status === 200, page.status);
  check("La section « Sauvegarde de la base » est rendue", html.includes("Sauvegarde de la base"));
  check("Le bouton « Sauvegarder maintenant » est rendu", html.includes("Sauvegarder maintenant"));
  check("Le champ de planification est rendu", html.includes("Sauvegarde automatique"));
  check("Le bouton de restauration est rendu", html.includes("Restaurer"));

  console.log(`\n${failures === 0 ? "Tous les tests sont passés." : `${failures} test(s) en échec.`}`);
  await prisma.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
