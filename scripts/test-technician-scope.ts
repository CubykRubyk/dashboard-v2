/**
 * Vérifie qu'un compte TECHNICIEN ne voit que son propre travail.
 *
 *   npx tsx --env-file=.env scripts/test-technician-scope.ts
 *
 * Crée deux techniciens (l'un rattaché à Dolibarr, l'autre non), trois interventions locales et
 * deux fiches, puis contrôle le cloisonnement — y compris l'accès direct par URL à une
 * intervention qui ne lui appartient pas. Tout est supprimé à la fin, même en cas d'échec.
 */
import { hash } from "bcryptjs";
import { SignJWT } from "jose";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3005";
const PREFIX = "zz-scope-test";

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
  await prisma.workSheet.deleteMany({ where: { client: { startsWith: PREFIX } } });
  await prisma.interventionPlanning.deleteMany({
    where: { dolibarrEventId: { startsWith: PREFIX } },
  });
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
}

async function main() {
  await cleanup();

  const passwordHash = await hash("MotDePasseTest2026!", 12);
  const [linked, unlinked, operator] = await Promise.all([
    prisma.user.create({
      data: {
        email: `${PREFIX}-lie@test.local`,
        name: "Technicien Lié",
        passwordHash,
        role: "TECHNICIEN",
        dolibarrUserId: "990001",
      },
    }),
    prisma.user.create({
      data: {
        email: `${PREFIX}-non-lie@test.local`,
        name: "Technicien Non Lié",
        passwordHash,
        role: "TECHNICIEN",
      },
    }),
    prisma.user.create({
      data: {
        email: `${PREFIX}-operateur@test.local`,
        name: "Opérateur Test",
        passwordHash,
        role: "OPERATOR",
      },
    }),
  ]);

  // Interventions locales uniquement (`dolibarrEventId` non numérique) : jamais dans Dolibarr.
  const today = new Date();
  const [mine, other, unowned] = await Promise.all([
    prisma.interventionPlanning.create({
      data: {
        dolibarrEventId: `${PREFIX}-a`,
        reference: "ZZ-A",
        title: "Intervention du technicien lié",
        dolibarrOwnerId: "990001",
        team: "Technicien Lié",
        startAt: today,
      },
    }),
    prisma.interventionPlanning.create({
      data: {
        dolibarrEventId: `${PREFIX}-b`,
        reference: "ZZ-B",
        title: "Intervention d’un autre technicien",
        dolibarrOwnerId: "990002",
        team: "Autre",
        startAt: today,
      },
    }),
    prisma.interventionPlanning.create({
      data: {
        dolibarrEventId: `${PREFIX}-c`,
        reference: "ZZ-C",
        title: "Intervention sans propriétaire",
        team: "",
        startAt: today,
      },
    }),
  ]);

  await Promise.all([
    prisma.workSheet.create({
      data: {
        client: `${PREFIX} chantier envoyé`,
        company: "ZZ Test",
        installer: "Technicien Lié",
        status: "SENT",
        createdById: linked.id,
      },
    }),
    prisma.workSheet.create({
      data: {
        client: `${PREFIX} chantier brouillon`,
        company: "ZZ Test",
        installer: "Technicien Lié",
        status: "COMPLETED",
        createdById: linked.id,
      },
    }),
    prisma.workSheet.create({
      data: {
        client: `${PREFIX} chantier d’un autre`,
        company: "ZZ Test",
        installer: "Autre",
        status: "SENT",
        createdById: operator.id,
      },
    }),
  ]);

  try {
    const linkedCookie = await cookieFor({ ...linked, role: "TECHNICIEN" });
    const unlinkedCookie = await cookieFor({ ...unlinked, role: "TECHNICIEN" });
    const operatorCookie = await cookieFor({ ...operator, role: "OPERATOR" });

    // 1) Un technicien entre bien dans l'application mobile (avant, `canViewSav` le rejetait).
    const entry = await fetch(`${BASE_URL}/mobile`, {
      headers: { cookie: linkedCookie },
      redirect: "manual",
    });
    check("Un TECHNICIEN accède à /mobile (200, plus de redirection)", entry.status === 200,
      { status: entry.status, location: entry.headers.get("location") });

    const html = await entry.text();
    check("Son intervention est présente", html.includes("Intervention du technicien lié"));
    check("L’intervention d’un autre technicien est absente",
      !html.includes("Intervention d’un autre technicien"));
    check("Une intervention sans propriétaire est absente",
      !html.includes("Intervention sans propriétaire"));
    check("L’onglet SAV est remplacé par Chantiers",
      html.includes("Chantiers") && !html.includes(">SAV<"), );

    // 2) L'opérateur, lui, voit tout.
    const operatorView = await fetch(`${BASE_URL}/mobile`, { headers: { cookie: operatorCookie } });
    const operatorHtml = await operatorView.text();
    check("Un OPERATOR voit toutes les interventions",
      operatorHtml.includes("Intervention du technicien lié")
      && operatorHtml.includes("Intervention d’un autre technicien"));

    // 3) Accès direct par URL à l'intervention d'un autre : doit échouer.
    const forbidden = await fetch(`${BASE_URL}/mobile/item/${other.id}`, {
      headers: { cookie: linkedCookie },
      redirect: "manual",
    });
    check("Accès direct à l’intervention d’un autre → 404",
      forbidden.status === 404, forbidden.status);

    const allowed = await fetch(`${BASE_URL}/mobile/item/${mine.id}`, {
      headers: { cookie: linkedCookie },
    });
    check("Accès à sa propre intervention → 200", allowed.status === 200, allowed.status);

    // 4) L'onglet SAV reste inaccessible en contenu pour un technicien.
    const savPage = await fetch(`${BASE_URL}/mobile/sav`, { headers: { cookie: linkedCookie } });
    const savHtml = await savPage.text();
    check("La page SAV n’expose aucun ticket à un technicien",
      !savHtml.includes("SAV-"), savPage.status);

    // 5) Chantiers : uniquement les fiches envoyées, et seulement les siennes.
    const sites = await fetch(`${BASE_URL}/mobile/chantiers`, { headers: { cookie: linkedCookie } });
    const sitesHtml = await sites.text();
    check("GET /mobile/chantiers → 200", sites.status === 200, sites.status);
    check("Le chantier envoyé apparaît", sitesHtml.includes("chantier envoyé"));
    check("Le brouillon n’apparaît pas (pas encore envoyé)",
      !sitesHtml.includes("chantier brouillon"));
    check("Le chantier d’un autre n’apparaît pas", !sitesHtml.includes("chantier d’un autre"));

    // 6) Technicien sans rattachement : aucune intervention, et le message l'explique.
    const unlinkedView = await fetch(`${BASE_URL}/mobile`, { headers: { cookie: unlinkedCookie } });
    const unlinkedHtml = await unlinkedView.text();
    check("Un technicien non rattaché ne voit aucune intervention",
      !unlinkedHtml.includes("Intervention du technicien lié")
      && !unlinkedHtml.includes("Intervention d’un autre technicien"));
    check("Le bandeau « compte incomplet » est affiché",
      unlinkedHtml.includes("Compte incomplet") || unlinkedHtml.includes("Cont incomplet"),
    );
    check("Le technicien rattaché ne voit pas ce bandeau",
      !html.includes("Compte incomplet"));

    void unowned;
  } finally {
    await cleanup();
    console.log("\n· Comptes, interventions et fiches de test supprimés.");
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
