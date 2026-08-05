/**
 * Vérifie l'édition d'une intervention (route `PATCH /api/planification-sav/interventions/[id]`).
 *
 *   npx tsx --env-file=.env scripts/test-intervention-edit.ts
 *
 * ⚠️ **Ce script n'écrit jamais dans Dolibarr.** L'instance configurée est celle de production :
 * modifier un vrai événement d'agenda serait irréversible. Le test utilise donc une intervention
 * **locale** dont le `dolibarrEventId` n'est volontairement pas numérique (`ZZ-EDIT-…`) : la
 * relecture préalable de l'événement échoue immédiatement côté Dolibarr, avant tout PUT.
 *
 * Sont couverts : les autorisations, la validation, le refus d'un technicien sans identifiant
 * Dolibarr, et le traitement d'un échec Dolibarr (502, erreur mémorisée, miroir local intact).
 * Le chemin nominal — un PUT réellement accepté — ne peut être vérifié que par Ion, sur un
 * événement de test créé exprès dans Dolibarr.
 */
import { hash } from "bcryptjs";
import { SignJWT } from "jose";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3005";
const PREFIX = "ZZ-EDIT";

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
  await prisma.interventionPlanning.deleteMany({
    where: { dolibarrEventId: { startsWith: PREFIX } },
  });
  await prisma.user.deleteMany({ where: { email: { startsWith: "zz-edit-test" } } });
}

async function main() {
  await cleanup();

  const admin = await prisma.user.findFirst({ where: { role: "ADMIN", active: true } });
  if (!admin) throw new Error("Aucun compte ADMIN actif en base.");

  const passwordHash = await hash("MotDePasseTest2026!", 12);
  const [operator, linkedTech, unlinkedTech] = await Promise.all([
    prisma.user.create({
      data: { email: "zz-edit-test-op@test.local", name: "Op Test", passwordHash, role: "OPERATOR" },
    }),
    prisma.user.create({
      data: {
        email: "zz-edit-test-tech@test.local",
        name: "Tech Rattaché",
        passwordHash,
        role: "TECHNICIEN",
        dolibarrUserId: "995001",
      },
    }),
    prisma.user.create({
      data: {
        email: "zz-edit-test-tech2@test.local",
        name: "Tech Sans Id",
        passwordHash,
        role: "TECHNICIEN",
      },
    }),
  ]);

  // Intervention purement locale : `dolibarrEventId` non numérique ⇒ aucun événement réel visé.
  const intervention = await prisma.interventionPlanning.create({
    data: {
      dolibarrEventId: `${PREFIX}-${Date.now()}`,
      reference: "ZZ-EDIT-1",
      title: "Intervention de test (locale)",
      company: "ZZ Test",
      address: "1 rue du Test, 75001 Paris",
      team: "Équipe initiale",
      dolibarrOwnerId: "995099",
      startAt: new Date("2026-08-10T08:00:00.000Z"),
      endAt: new Date("2026-08-10T12:00:00.000Z"),
    },
  });

  try {
    const adminCookie = await cookieFor({ ...admin, role: "ADMIN" });
    const operatorCookie = await cookieFor({ ...operator, role: "OPERATOR" });
    const url = `${BASE_URL}/api/planification-sav/interventions/${intervention.id}`;

    // 1) Autorisations : l'édition est ADMIN uniquement, plus strict que le reste du module.
    const anonymous = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Piraté" }),
    });
    check("Sans session → 403", anonymous.status === 403, anonymous.status);

    const asOperator = await fetch(url, {
      method: "PATCH",
      headers: { cookie: operatorCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Par un opérateur" }),
    });
    check("Un OPERATOR est refusé → 403", asOperator.status === 403, asOperator.status);

    // 2) Validation.
    const emptyPatch = await fetch(url, {
      method: "PATCH",
      headers: { cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    check("Patch vide → 400", emptyPatch.status === 400, emptyPatch.status);

    const badDate = await fetch(url, {
      method: "PATCH",
      headers: { cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ startAt: "10/08/2026 08:00" }),
    });
    check("Format de date invalide → 400", badDate.status === 400, badDate.status);

    // 3) Un technicien sans identifiant Dolibarr ne peut pas recevoir d'intervention, et le
    // message doit dire quoi faire.
    const unlinkedAssign = await fetch(url, {
      method: "PATCH",
      headers: { cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ assigneeUserId: unlinkedTech.id }),
    });
    const unlinkedBody = await unlinkedAssign.json();
    check("Affecter un technicien sans identifiant Dolibarr → 400",
      unlinkedAssign.status === 400, unlinkedAssign.status);
    check("Le message indique où corriger",
      typeof unlinkedBody.error === "string" && unlinkedBody.error.includes("Utilisateurs"),
      unlinkedBody);

    const unknownAssign = await fetch(url, {
      method: "PATCH",
      headers: { cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ assigneeUserId: "utilisateur-inexistant" }),
    });
    check("Technicien inexistant → 400", unknownAssign.status === 400, unknownAssign.status);

    // 4) Échec Dolibarr (l'événement n'existe pas là-bas) : la route doit répondre proprement,
    // mémoriser l'erreur, et surtout **ne rien modifier localement**.
    const before = await prisma.interventionPlanning.findUnique({ where: { id: intervention.id } });
    const failing = await fetch(url, {
      method: "PATCH",
      headers: { cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Titre modifié",
        startAt: "2026-08-11T09:30",
        assigneeUserId: linkedTech.id,
      }),
    });
    const failingBody = await failing.json();
    check("Événement absent de Dolibarr → 502 (pas un 500 opaque)",
      failing.status === 502, { status: failing.status, body: failingBody });
    check("Le message d’erreur est explicite",
      typeof failingBody.error === "string" && failingBody.error.includes("Dolibarr"), failingBody);

    const after = await prisma.interventionPlanning.findUnique({ where: { id: intervention.id } });
    check("Le titre local est inchangé après un échec Dolibarr",
      after?.title === before?.title, { before: before?.title, after: after?.title });
    check("La date locale est inchangée",
      after?.startAt?.toISOString() === before?.startAt?.toISOString());
    check("L’affectation locale est inchangée",
      after?.dolibarrOwnerId === before?.dolibarrOwnerId,
      { before: before?.dolibarrOwnerId, after: after?.dolibarrOwnerId });
    check("L’erreur Dolibarr est mémorisée sur l’intervention",
      Boolean(after?.dolibarrLastError), after?.dolibarrLastError);

    const errorAudit = await prisma.auditLog.findFirst({
      where: { action: "INTERVENTION_DOLIBARR_ERROR", entityId: intervention.id },
    });
    check("Une ligne d’audit d’échec est écrite", Boolean(errorAudit));

    // 5) Aucune notification n'est envoyée quand la modification n'a pas abouti.
    const notified = await prisma.notification.count({
      where: { userId: linkedTech.id, entityId: intervention.id },
    });
    check("Le technicien n’est pas notifié d’une affectation qui a échoué", notified === 0, notified);
  } finally {
    await cleanup();
    console.log("\n· Intervention et comptes de test supprimés. Aucun écrit dans Dolibarr.");
  }

  console.log(`\n${failures === 0 ? "Tous les tests sont passés." : `${failures} test(s) en échec.`}`);
  console.log(
    "\nNon couvert ici : un PUT réellement accepté par Dolibarr. À vérifier sur un événement\n"
    + "d'agenda créé exprès pour le test dans Dolibarr — jamais sur une intervention réelle.",
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
