/**
 * Remet la note privée d'un événement Dolibarr à une valeur donnée (vide par défaut).
 *
 *   npx tsx --env-file=.env scripts/clear-event-note.ts <ID_EVENEMENT> ["nouvelle note"]
 *
 * Écrit dans Dolibarr. Sert à nettoyer après un test d'écriture, et à vérifier si une chaîne vide
 * suffit à effacer une note (certaines API ignorent les valeurs vides lors d'un PUT).
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
  const note = process.argv[3] ?? "";
  if (!eventId) {
    console.error('Usage : npx tsx --env-file=.env scripts/clear-event-note.ts <ID_EVENEMENT> ["note"]');
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
  const cookie = `dashboard_session=${token}`;

  const row = await prisma.interventionPlanning.findUnique({ where: { dolibarrEventId: eventId } });
  if (!row) throw new Error(`Événement ${eventId} absent du miroir local.`);

  const before = await fetch(`${BASE_URL}/api/dolibarr/events/${eventId}?refresh=1`, {
    headers: { cookie },
  }).then((r) => r.json());
  console.log(`Note avant : « ${(before.note || "(vide)").slice(0, 100)} »`);

  const response = await fetch(`${BASE_URL}/api/planification-sav/interventions/${row.id}`, {
    method: "PATCH",
    headers: { cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ note }),
  });
  console.log(`PATCH : ${response.status}`);
  if (!response.ok) console.error(await response.json().catch(() => ({})));

  const after = await fetch(`${BASE_URL}/api/dolibarr/events/${eventId}?refresh=1`, {
    headers: { cookie },
  }).then((r) => r.json());
  console.log(`Note après : « ${(after.note || "(vide)").slice(0, 100)} »`);
  console.log(
    (after.note || "") === note
      ? "\n✓ La note vaut bien la valeur demandée."
      : "\n✗ La note ne correspond pas à ce qui a été envoyé.",
  );

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
