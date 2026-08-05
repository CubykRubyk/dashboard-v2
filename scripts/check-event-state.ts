/**
 * Contrôle ponctuel de l'état d'un événement Dolibarr — **lecture seule**, rien n'est modifié.
 *
 *   npx tsx --env-file=.env scripts/check-event-state.ts <ID_EVENEMENT>
 *
 * Utile après un test d'écriture pour vérifier que l'événement est bien revenu à son état initial.
 */
import { SignJWT } from "jose";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3005";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const eventId = process.argv[2];
  if (!eventId) {
    console.error("Usage : npx tsx --env-file=.env scripts/check-event-state.ts <ID_EVENEMENT>");
    process.exit(1);
  }

  const admin = await prisma.user.findFirst({ where: { role: "ADMIN", active: true } });
  if (!admin) throw new Error("Aucun compte ADMIN actif.");
  const token = await new SignJWT({
    user: { id: admin.id, email: admin.email, name: admin.name, role: "ADMIN" },
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
    .sign(new TextEncoder().encode(process.env.AUTH_SECRET!));

  // `?refresh=1` : on veut l'état réel côté Dolibarr, pas le cache de 5 minutes de la route.
  const response = await fetch(`${BASE_URL}/api/dolibarr/events/${eventId}?refresh=1`, {
    headers: { cookie: `dashboard_session=${token}` },
  });
  const event = await response.json();
  const row = await prisma.interventionPlanning.findUnique({
    where: { dolibarrEventId: eventId },
  });

  console.log(`Événement ${eventId} — dans Dolibarr :`);
  console.log(`  libellé : ${event.label ?? "(vide)"}`);
  console.log(`  adresse : ${event.address || "(vide)"}`);
  console.log(`  note    : ${(event.note || "(vide)").slice(0, 90)}`);
  console.log(`  client  : ${event.client || "(vide)"}`);
  console.log("Miroir local :");
  console.log(`  début   : ${row?.startAt?.toISOString().slice(0, 16).replace("T", " ") ?? "(vide)"}`);
  console.log(`  fin     : ${row?.endAt?.toISOString().slice(0, 16).replace("T", " ") ?? "(vide)"}`);
  console.log(`  équipe  : ${row?.team || "(aucune)"} (userownerid ${row?.dolibarrOwnerId ?? "—"})`);
  console.log(`  erreur  : ${row?.dolibarrLastError ?? "(aucune)"}`);

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
