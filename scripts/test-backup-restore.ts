/**
 * Test réel de restauration, de bout en bout et par l'API — sans jamais toucher à la base de dev.
 *
 *   npx tsx --env-file=.env scripts/test-backup-restore.ts
 *
 * Déroulé :
 *   1. sauvegarde la base de dev via l'API du serveur déjà lancé (BASE_URL, défaut :3005) ;
 *   2. crée une base jetable `dashboard_backup_test` (vide) ;
 *   3. **arrête le serveur de dev** (Next 16 refuse deux `next dev` sur le même dossier) et en
 *      relance un branché sur la base jetable ; le dump est déjà en mémoire à ce stade ;
 *   4. envoie le dump à `POST /api/settings/backup/restore` de ce second serveur — c'est bien le
 *      code de production qui s'exécute, upload multipart et vérification de signature compris ;
 *   5. vérifie en SQL que les données sont arrivées, puis supprime la base jetable.
 *
 * Restaurer par-dessus la base de dev détruirait les données de travail : ce chemin n'est
 * volontairement jamais exercé. La session admin est un JWT signé — `getSession()` ne lit pas la
 * base, un compte n'a donc pas besoin d'exister dans la base jetable pour authentifier l'appel.
 */
import { execFile, spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { SignJWT } from "jose";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

const execFileAsync = promisify(execFile);

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3005";
const TEST_DATABASE = "dashboard_backup_test";
const TEST_PORT = 3006;
const COOKIE_NAME = "dashboard_session";

let failures = 0;
function check(label: string, condition: boolean, detail?: unknown) {
  if (condition) console.log(`✓ ${label}`);
  else {
    failures += 1;
    console.error(`✗ ${label}`, detail ?? "");
  }
}

function psqlBin() {
  const dump = process.env.PG_DUMP_BIN;
  return dump ? path.join(path.dirname(dump), "psql") : "psql";
}

function psqlEnv(database: string) {
  const url = new URL(process.env.DATABASE_URL!);
  return {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || "5432",
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: database,
    LC_ALL: "C",
  };
}

async function psql(database: string, sql: string) {
  const { stdout } = await execFileAsync(psqlBin(), ["-tAc", sql], { env: psqlEnv(database) });
  return stdout.trim();
}

/** Comptage tolérant : une table absente vaut -1 plutôt qu'une exception qui masque les vrais échecs. */
async function countRows(database: string, table: string) {
  return await psql(database, `SELECT count(*) FROM "${table}"`)
    .then(Number)
    .catch(() => -1);
}

async function adminCookie(user: { id: string; email: string; name: string }) {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET manquant ou trop court.");
  const token = await new SignJWT({ user: { ...user, role: "ADMIN" } })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
    .sign(new TextEncoder().encode(secret));
  return `${COOKIE_NAME}=${token}`;
}

async function stopServerOnPort(port: number) {
  // `-sTCP:LISTEN` est indispensable : sans lui, `lsof -ti :PORT` renvoie aussi les *clients*
  // ayant une connexion ouverte sur ce port — dont ce script lui-même, qui vient d'appeler l'API.
  // Il se tuait alors lui-même au premier SIGKILL.
  const { stdout } = await execFileAsync("lsof", ["-ti", `:${port}`, "-sTCP:LISTEN"]).catch(() => ({
    stdout: "",
  }));
  for (const pid of stdout.split("\n").map((line) => line.trim()).filter(Boolean)) {
    if (Number(pid) === process.pid) continue;
    try {
      process.kill(Number(pid), "SIGKILL");
    } catch {
      /* déjà arrêté */
    }
  }
  // Laisse le port se libérer avant que le second serveur ne tente de se lier.
  await new Promise((resolve) => setTimeout(resolve, 1500));
}

async function waitForServer(url: string, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await fetch(url);
      return true;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  return false;
}

async function main() {
  const sourceUrl = new URL(process.env.DATABASE_URL!);
  const sourceDatabase = decodeURIComponent(sourceUrl.pathname.replace(/^\//, ""));
  console.log(`Base source : ${sourceDatabase} · base jetable : ${TEST_DATABASE}\n`);

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });

  // Compte admin réel : les écritures d'audit du serveur principal ont une contrainte de clé
  // étrangère sur `User`. Le second serveur (base jetable) accepte n'importe quel JWT signé,
  // `getSession()` ne lisant pas la base.
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN", active: true } });
  if (!admin) throw new Error("Aucun compte ADMIN actif en base.");
  const cookie = await adminCookie(admin);

  const expected = {
    users: await prisma.user.count(),
    workSheets: await prisma.workSheet.count(),
    auditLogs: await prisma.auditLog.count(),
  };
  await prisma.$disconnect();
  console.log(
    `Contenu attendu : ${expected.users} utilisateurs, ${expected.workSheets} fiches, ${expected.auditLogs} lignes d’audit\n`,
  );

  // 1) Sauvegarde de la base de dev, via l'API.
  const created = await fetch(`${BASE_URL}/api/settings/backup`, { method: "POST", headers: { cookie } });
  const createdBody = await created.json();
  check("Sauvegarde créée via l’API", created.status === 201, createdBody);
  const fileName = createdBody?.backup?.fileName as string;
  if (!fileName) throw new Error("Pas de sauvegarde à restaurer, abandon.");

  const downloaded = await fetch(`${BASE_URL}/api/settings/backup/${fileName}`, { headers: { cookie } });
  const dumpBytes = Buffer.from(await downloaded.arrayBuffer());
  check("Dump téléchargé", dumpBytes.byteLength > 0 && dumpBytes.subarray(0, 5).toString() === "PGDMP");

  let server: ReturnType<typeof spawn> | null = null;
  try {
    // 2) Base jetable, recréée à neuf (un run interrompu a pu la laisser derrière).
    await psql("postgres", `DROP DATABASE IF EXISTS ${TEST_DATABASE}`);
    await psql("postgres", `CREATE DATABASE ${TEST_DATABASE}`);
    check("Base jetable créée (vide)", true);

    // 3) Next 16 refuse deux `next dev` sur le même dossier : on arrête celui de dev (le dump est
    // déjà en mémoire, on n'en a plus besoin) et on en relance un sur la base jetable.
    await stopServerOnPort(Number(new URL(BASE_URL).port || 3000));
    const testUrl = new URL(process.env.DATABASE_URL!);
    testUrl.pathname = `/${TEST_DATABASE}`;
    server = spawn("npm", ["run", "dev"], {
      env: { ...process.env, DATABASE_URL: testUrl.toString(), PORT: String(TEST_PORT) },
      stdio: "ignore",
      detached: true,
    });
    const testBase = `http://localhost:${TEST_PORT}`;
    const up = await waitForServer(`${testBase}/login`);
    check("Second serveur démarré sur la base jetable", up);
    if (!up) throw new Error("Le second serveur n’a pas démarré.");

    // 4) Une confirmation erronée doit être refusée même ici.
    const wrongConfirmation = new FormData();
    wrongConfirmation.set("confirmation", sourceDatabase); // nom de l'AUTRE base
    wrongConfirmation.set("file", new Blob([new Uint8Array(dumpBytes)]), fileName);
    const refused = await fetch(`${testBase}/api/settings/backup/restore`, {
      method: "POST",
      headers: { cookie },
      body: wrongConfirmation,
    });
    check("Confirmation erronée refusée (400)", refused.status === 400, refused.status);

    // 5) Restauration réelle, par l'API, avec la bonne confirmation.
    const form = new FormData();
    form.set("confirmation", TEST_DATABASE);
    form.set("file", new Blob([new Uint8Array(dumpBytes)]), fileName);
    const restored = await fetch(`${testBase}/api/settings/backup/restore`, {
      method: "POST",
      headers: { cookie },
      body: form,
    });
    const restoredBody = await restored.json();
    check("Restauration via l’API → 200", restored.status === 200, restoredBody);
    check("Un avertissement de redémarrage est renvoyé", typeof restoredBody.warning === "string", restoredBody);

    // 6) Les données sont bien arrivées dans la base jetable.
    const restoredUsers = await countRows(TEST_DATABASE, "User");
    const restoredSheets = await countRows(TEST_DATABASE, "WorkSheet");
    const restoredAudit = await countRows(TEST_DATABASE, "AuditLog");
    check(`Utilisateurs restaurés (${restoredUsers}/${expected.users})`, restoredUsers === expected.users);
    check(`Fiches restaurées (${restoredSheets}/${expected.workSheets})`, restoredSheets === expected.workSheets);
    check(`Lignes d’audit restaurées (${restoredAudit}/${expected.auditLogs})`, restoredAudit === expected.auditLogs);

    // 7) Le dump porte bien le schéma courant (colonnes ajoutées par la migration de sauvegarde).
    const columns = await psql(
      TEST_DATABASE,
      `SELECT string_agg(column_name, ',' ORDER BY column_name) FROM information_schema.columns
       WHERE table_name = 'AppSettings' AND column_name LIKE 'backup%'`,
    );
    check(
      "Les colonnes backup* sont présentes après restauration",
      columns === "backupIntervalHours,backupLastError,backupLastRunAt",
      columns,
    );

    // 8) Et surtout : la base de dev n'a pas bougé.
    const sourceUsers = await countRows(sourceDatabase, "User");
    check("La base de développement est intacte", sourceUsers === expected.users, {
      sourceUsers,
      expected: expected.users,
    });
  } finally {
    if (server?.pid) {
      try {
        process.kill(-server.pid, "SIGKILL");
      } catch {
        /* déjà mort */
      }
    }
    await psql("postgres", `DROP DATABASE IF EXISTS ${TEST_DATABASE}`).catch(() => undefined);
    // Suppression directe sur disque : le serveur qui exposait l'API a été arrêté à l'étape 3.
    const root = process.env.DB_BACKUP_STORAGE_ROOT?.trim() || path.join(process.cwd(), "data", "db-backups");
    await rm(path.resolve(root, fileName), { force: true }).catch(() => undefined);
    console.log("\n· Base jetable supprimée, serveur de test arrêté, dump de test effacé.");
    console.log(`· Le serveur de dev sur ${BASE_URL} a été arrêté par ce test — relancez-le si besoin.`);
  }

  console.log(`\n${failures === 0 ? "Tous les tests sont passés." : `${failures} test(s) en échec.`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
