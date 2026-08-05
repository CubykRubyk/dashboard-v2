/**
 * Vérification RÉELLE de l'écriture vers Dolibarr, de bout en bout par l'API de l'application.
 *
 *   npx tsx --env-file=.env scripts/test-dolibarr-write-live.ts <ID_EVENEMENT> [--yes]
 *
 * ⚠️ Ce script **écrit** dans Dolibarr : à lancer uniquement sur un événement créé exprès pour le
 * test. Deux garde-fous : il affiche l'événement avant d'agir, et il **restaure les valeurs
 * d'origine** à la fin, quoi qu'il arrive.
 *
 * Tout passe par les routes de l'application (`/api/planification-sav/interventions/[id]`), donc
 * c'est exactement le chemin qu'emprunte le bouton « Modifier » du drawer — pas une simulation.
 * La relecture se fait via `/api/dolibarr/events/[id]?refresh=1`, qui interroge Dolibarr sans
 * passer par le cache : on vérifie ce que Dolibarr a réellement enregistré, pas notre miroir local.
 */
import { createInterface } from "node:readline/promises";

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

async function adminCookie() {
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN", active: true } });
  if (!admin) throw new Error("Aucun compte ADMIN actif en base.");
  const token = await new SignJWT({
    user: { id: admin.id, email: admin.email, name: admin.name, role: "ADMIN" },
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
    .sign(new TextEncoder().encode(process.env.AUTH_SECRET!));
  return `dashboard_session=${token}`;
}

/** Vue Dolibarr fraîche (sans cache) de l'événement. */
async function readFromDolibarr(eventId: string, cookie: string) {
  const response = await fetch(`${BASE_URL}/api/dolibarr/events/${eventId}?refresh=1`, {
    headers: { cookie },
  });
  if (!response.ok) throw new Error(`Lecture Dolibarr impossible (${response.status})`);
  return response.json() as Promise<{
    label?: string;
    workDate?: string;
    address?: string;
    client?: string;
    installer?: string;
    note?: string;
  }>;
}

/** `Date` → valeur `datetime-local` attendue par la route (heure de Paris, sans fuseau). */
function toLocalInput(date: Date | null) {
  return date ? date.toISOString().slice(0, 16) : null;
}

async function patch(interventionId: string, cookie: string, body: Record<string, unknown>) {
  const response = await fetch(`${BASE_URL}/api/planification-sav/interventions/${interventionId}`, {
    method: "PATCH",
    headers: { cookie, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  return { status: response.status, payload };
}

async function main() {
  const eventId = process.argv[2];
  const skipPrompt = process.argv.includes("--yes");
  if (!eventId || !/^\d+$/.test(eventId)) {
    console.error("Usage : npx tsx --env-file=.env scripts/test-dolibarr-write-live.ts <ID_EVENEMENT> [--yes]");
    process.exit(1);
  }

  const cookie = await adminCookie();

  // 1) L'événement doit exister dans le miroir local : la route travaille sur `InterventionPlanning`.
  let row = await prisma.interventionPlanning.findUnique({ where: { dolibarrEventId: eventId } });
  if (!row) {
    console.log("→ Événement absent du miroir local, synchronisation Dolibarr…");
    const sync = await fetch(`${BASE_URL}/api/planification-sav/sync`, { method: "POST", headers: { cookie } });
    console.log(`  sync : ${sync.status}`);
    row = await prisma.interventionPlanning.findUnique({ where: { dolibarrEventId: eventId } });
  }
  if (!row) {
    console.error(
      `\nL’événement ${eventId} n’a pas été synchronisé. La fenêtre de synchro couvre aujourd’hui → +14 jours :\n`
      + "vérifiez que la date de l’événement tombe bien dans cet intervalle.",
    );
    await prisma.$disconnect();
    process.exit(1);
  }

  const before = await readFromDolibarr(eventId, cookie);
  const originalStart = row.startAt;
  const originalEnd = row.endAt;

  console.log(`\nÉvénement ${eventId} (vu de Dolibarr) :`);
  console.log(`  libellé     : ${before.label ?? "(vide)"}`);
  console.log(`  début local : ${originalStart?.toISOString().slice(0, 16).replace("T", " ") ?? "(vide)"}`);
  console.log(`  fin locale  : ${originalEnd?.toISOString().slice(0, 16).replace("T", " ") ?? "(vide)"}`);
  console.log(`  adresse     : ${before.address ?? "(vide)"}`);
  console.log(`  technicien  : ${row.team || "(aucun)"} (userownerid ${row.dolibarrOwnerId ?? "—"})`);
  console.log(`  note        : ${(before.note ?? "").slice(0, 120) || "(vide)"}`);

  if (!skipPrompt) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question("\nCe script va MODIFIER cet événement puis restaurer ses valeurs. Continuer ? (oui/non) ");
    rl.close();
    if (answer.trim().toLowerCase() !== "oui") {
      console.log("Annulé, rien n’a été modifié.");
      await prisma.$disconnect();
      process.exit(0);
    }
  }

  // Créneau volontairement inhabituel : un décalage de fuseau saute aux yeux.
  const testStart = "2026-08-12T14:35";
  const testEnd = "2026-08-12T16:05";
  const testLabel = "TEST écriture — libellé modifié";
  const testAddress = "42 rue de Rivoli, 75004 Paris";
  const testNote = "TEST écriture — note privée modifiée par le script de vérification.";

  // Technicien : on ne réaffecte que si un compte rattaché existe, et jamais vers l'actuel.
  const technician = await prisma.user.findFirst({
    where: { active: true, dolibarrUserId: { not: null, ...(row.dolibarrOwnerId ? { not: row.dolibarrOwnerId } : {}) } },
    select: { id: true, name: true, dolibarrUserId: true },
  });

  try {
    console.log("\n→ Écriture (libellé, dates, adresse, note" + (technician ? ", technicien" : "") + ")…");
    const result = await patch(row.id, cookie, {
      title: testLabel,
      startAt: testStart,
      endAt: testEnd,
      address: testAddress,
      note: testNote,
      ...(technician ? { assigneeUserId: technician.id } : {}),
    });
    check("La route a accepté la modification (200)", result.status === 200, result.payload);
    if (result.status !== 200) throw new Error("Modification refusée, arrêt avant vérification.");

    const after = await readFromDolibarr(eventId, cookie);
    const local = await prisma.interventionPlanning.findUnique({ where: { id: row.id } });

    console.log("\nRelu depuis Dolibarr :");
    console.log(`  libellé  : ${after.label}`);
    console.log(`  adresse  : ${after.address}`);
    console.log(`  note     : ${(after.note ?? "").slice(0, 120)}`);
    console.log(`  début (miroir local) : ${local?.startAt?.toISOString().slice(0, 16).replace("T", " ")}`);

    check("Le libellé est enregistré dans Dolibarr", after.label === testLabel, after.label);
    check("L’adresse est enregistrée dans Dolibarr", (after.address ?? "").includes("Rivoli"), after.address);
    check("La note privée est enregistrée dans Dolibarr",
      (after.note ?? "").includes("note privée modifiée"), (after.note ?? "").slice(0, 160));

    // Le point critique : l'heure ne doit pas dériver entre ce qu'on envoie et ce qui est stocké.
    check("L’heure de début est celle envoyée, sans décalage de fuseau",
      local?.startAt?.toISOString().slice(0, 16) === `${testStart}`,
      { envoyé: testStart, relu: local?.startAt?.toISOString().slice(0, 16) });
    check("L’heure de fin est celle envoyée",
      local?.endAt?.toISOString().slice(0, 16) === `${testEnd}`,
      { envoyé: testEnd, relu: local?.endAt?.toISOString().slice(0, 16) });

    if (technician) {
      check("Le technicien a été réaffecté",
        local?.dolibarrOwnerId === technician.dolibarrUserId,
        { attendu: technician.dolibarrUserId, obtenu: local?.dolibarrOwnerId });
      const notified = await prisma.notification.count({
        where: { userId: technician.id, entityId: row.id, type: "INTERVENTION_ASSIGNED" },
      });
      check("Le technicien a été notifié de son affectation", notified > 0, notified);
    } else {
      console.log("· Aucun second compte rattaché à Dolibarr : réaffectation non testée.");
    }

    check("Le client rattaché n’a pas été perdu", (after.client ?? "") !== "" || (before.client ?? "") === "",
      { avant: before.client, après: after.client });

    console.log(`\n⚠️  VÉRIFIEZ MAINTENANT DANS DOLIBARR (événement ${eventId}) :`);
    console.log("   l’agenda doit afficher le 12/08/2026 de 14:35 à 16:05.");
    console.log("   Si l’heure diffère, c’est le décalage de fuseau — signalez-le.");
    if (!skipPrompt) {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      await rl.question("\nEntrée pour restaurer les valeurs d’origine… ");
      rl.close();
    }
  } finally {
    console.log("\n→ Restauration des valeurs d’origine…");
    const restore = await patch(row.id, cookie, {
      title: before.label ?? "",
      startAt: toLocalInput(originalStart),
      endAt: toLocalInput(originalEnd),
      address: before.address ?? "",
      note: before.note ?? "",
      ...(row.dolibarrOwnerId
        ? await (async () => {
            const owner = await prisma.user.findFirst({
              where: { dolibarrUserId: row!.dolibarrOwnerId },
              select: { id: true },
            });
            return owner ? { assigneeUserId: owner.id } : {};
          })()
        : {}),
    });
    if (restore.status === 200) {
      const restored = await readFromDolibarr(eventId, cookie).catch(() => null);
      check("L’événement est revenu à son libellé initial",
        restored?.label === before.label, { attendu: before.label, obtenu: restored?.label });
    } else {
      console.error("⚠️  Restauration échouée :", restore.payload);
      console.error("   Valeurs d’origine à remettre à la main :", {
        label: before.label,
        début: originalStart?.toISOString(),
        fin: originalEnd?.toISOString(),
        adresse: before.address,
      });
    }
  }

  console.log(`\n${failures === 0 ? "Tous les contrôles sont passés." : `${failures} contrôle(s) en échec.`}`);
  await prisma.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
