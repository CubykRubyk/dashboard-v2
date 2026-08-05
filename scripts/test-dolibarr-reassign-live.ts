/**
 * Vérifie la **réaffectation du technicien** vers Dolibarr, sur un événement de test.
 *
 *   npx tsx --env-file=.env scripts/test-dolibarr-reassign-live.ts <ID_EVENEMENT> [<userownerid>]
 *
 * Sans second argument, le script réaffecte l'événement à son propriétaire **actuel** : le PUT est
 * réellement envoyé et accepté, mais l'agenda ne change pas de main. C'est le compromis quand on
 * ne dispose que d'un seul identifiant Dolibarr connu — on valide la mécanique (traduction compte
 * interne → `userownerid`, acceptation par Dolibarr) sans risquer d'affecter un événement à un
 * utilisateur inexistant.
 *
 * Avec un second `userownerid` valide, la réaffectation est réelle et l'état d'origine restauré.
 */
import { SignJWT } from "jose";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3005";
const TEST_EMAIL = "zz-reassign-test@test.local";

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

async function cleanup() {
  await prisma.notification.deleteMany({
    where: { user: { email: TEST_EMAIL } },
  });
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
}

async function main() {
  const eventId = process.argv[2];
  const targetOwnerId = process.argv[3];
  if (!eventId || !/^\d+$/.test(eventId)) {
    console.error("Usage : npx tsx --env-file=.env scripts/test-dolibarr-reassign-live.ts <ID_EVENEMENT> [<userownerid>]");
    process.exit(1);
  }

  await cleanup();

  const admin = await prisma.user.findFirst({ where: { role: "ADMIN", active: true } });
  if (!admin) throw new Error("Aucun compte ADMIN actif.");
  const token = await new SignJWT({
    user: { id: admin.id, email: admin.email, name: admin.name, role: "ADMIN" },
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
    .sign(new TextEncoder().encode(process.env.AUTH_SECRET!));
  const cookie = `dashboard_session=${token}`;

  const row = await prisma.interventionPlanning.findUnique({ where: { dolibarrEventId: eventId } });
  if (!row) {
    console.error(`Événement ${eventId} absent du miroir local — lancez d’abord une synchronisation.`);
    await prisma.$disconnect();
    process.exit(1);
  }

  const originalOwner = row.dolibarrOwnerId;
  const originalTeam = row.team;
  const owner = targetOwnerId ?? originalOwner;
  if (!owner) {
    console.error("Aucun `userownerid` connu : passez-en un en second argument.");
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log(`Événement ${eventId} — propriétaire actuel : ${originalTeam || "(aucun)"} (${originalOwner ?? "—"})`);
  console.log(`Cible de la réaffectation : userownerid ${owner}${targetOwnerId ? "" : " (identique — mécanique seule)"}\n`);

  // Compte technicien de test porteur de l'identifiant Dolibarr visé.
  const technician = await prisma.user.create({
    data: {
      email: TEST_EMAIL,
      name: "Tech Réaffectation Test",
      passwordHash: "x".repeat(60),
      role: "TECHNICIEN",
      dolibarrUserId: owner,
    },
  });

  try {
    const response = await fetch(`${BASE_URL}/api/planification-sav/interventions/${row.id}`, {
      method: "PATCH",
      headers: { cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ assigneeUserId: technician.id }),
    });
    const payload = await response.json().catch(() => ({}));
    check("Dolibarr a accepté la réaffectation (200)", response.status === 200, payload);

    const local = await prisma.interventionPlanning.findUnique({ where: { id: row.id } });
    check("Le miroir local porte le nouveau `userownerid`",
      local?.dolibarrOwnerId === owner, { attendu: owner, obtenu: local?.dolibarrOwnerId });
    check("Le nom d’équipe suit le compte affecté",
      local?.team === technician.name, { attendu: technician.name, obtenu: local?.team });
    check("Aucune erreur Dolibarr n’est mémorisée", local?.dolibarrLastError === null,
      local?.dolibarrLastError);

    // Notification : seulement si le propriétaire a réellement changé.
    const notified = await prisma.notification.count({
      where: { userId: technician.id, entityId: row.id, type: "INTERVENTION_ASSIGNED" },
    });
    if (targetOwnerId && targetOwnerId !== originalOwner) {
      check("Le technicien a été notifié", notified > 0, notified);
    } else {
      check("Pas de notification quand le propriétaire ne change pas", notified === 0, notified);
    }

    const audit = await prisma.auditLog.findFirst({
      where: { action: "INTERVENTION_DOLIBARR_EDIT", entityId: row.id },
      orderBy: { createdAt: "desc" },
    });
    check("Une ligne d’audit a été écrite", Boolean(audit));
  } finally {
    // Restauration : on remet le propriétaire d'origine côté Dolibarr **et** en local.
    if (originalOwner && originalOwner !== owner) {
      const originalAccount = await prisma.user.findFirst({
        where: { dolibarrUserId: originalOwner },
        select: { id: true },
      });
      if (originalAccount) {
        await fetch(`${BASE_URL}/api/planification-sav/interventions/${row.id}`, {
          method: "PATCH",
          headers: { cookie, "Content-Type": "application/json" },
          body: JSON.stringify({ assigneeUserId: originalAccount.id }),
        }).catch(() => undefined);
      } else {
        console.warn(`⚠️  Aucun compte ne porte le userownerid d’origine ${originalOwner} :`);
        console.warn("   remettez le propriétaire à la main dans Dolibarr si nécessaire.");
      }
    }
    // Le nom d'équipe local revient de toute façon à sa valeur d'origine à la prochaine synchro.
    await prisma.interventionPlanning
      .update({ where: { id: row.id }, data: { team: originalTeam, dolibarrOwnerId: originalOwner } })
      .catch(() => undefined);
    await cleanup();
    console.log("\n· Compte de test supprimé, propriétaire d’origine rétabli.");
  }

  console.log(`\n${failures === 0 ? "Tous les contrôles sont passés." : `${failures} contrôle(s) en échec.`}`);
  await prisma.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error(error);
  await cleanup().catch(() => undefined);
  await prisma.$disconnect();
  process.exit(1);
});
