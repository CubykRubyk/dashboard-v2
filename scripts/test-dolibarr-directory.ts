/**
 * Répertoire Dolibarr : favoris, filtrage, recherche, désactivation.
 *
 *   npx tsx --env-file=.env scripts/test-dolibarr-directory.ts
 *
 * ⚠️ **Aucun appel à l'API Dolibarr** : les entrées sont injectées directement en base, comme si
 * un import venait d'avoir lieu. Le parsing des vraies réponses est couvert séparément par
 * `tests/dolibarr/directory-parse.test.ts`, sur les exemples fournis par Ion.
 */
import { hash } from "bcryptjs";
import { SignJWT } from "jose";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3005";
const PREFIX = "zzdir";

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
  await prisma.dolibarrUser.deleteMany({ where: { dolibarrId: { startsWith: PREFIX } } });
  await prisma.dolibarrCompany.deleteMany({ where: { dolibarrId: { startsWith: PREFIX } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: "zz-dir-test" } } });
}

async function main() {
  await cleanup();

  const admin = await prisma.user.findFirst({ where: { role: "ADMIN", active: true } });
  if (!admin) throw new Error("Aucun compte ADMIN actif.");
  const adminCookie = await cookieFor({ ...admin, role: "ADMIN" });

  const viewer = await prisma.user.create({
    data: {
      email: "zz-dir-test-viewer@test.local",
      name: "Lecteur Test",
      passwordHash: await hash("MotDePasseTest2026!", 12),
      role: "VIEWER",
    },
  });
  const viewerCookie = await cookieFor({ ...viewer, role: "VIEWER" });

  // État « après import ».
  const [favoriteUser, plainUser, inactiveUser] = await Promise.all([
    prisma.dolibarrUser.create({
      data: { dolibarrId: `${PREFIX}-u1`, name: "Alain Favori", job: "Technicien", favorite: true },
    }),
    prisma.dolibarrUser.create({
      data: { dolibarrId: `${PREFIX}-u2`, name: "Bernard Ordinaire", job: "Technicien" },
    }),
    prisma.dolibarrUser.create({
      data: { dolibarrId: `${PREFIX}-u3`, name: "Claude Parti", active: false },
    }),
  ]);
  await Promise.all([
    prisma.dolibarrUser.create({
      data: { dolibarrId: `${PREFIX}-u4`, name: "Denise Direction", job: "Président", isEmployee: false },
    }),
    prisma.dolibarrCompany.create({
      data: { dolibarrId: `${PREFIX}-c1`, name: "ZZ Client Favori", town: "Paris", favorite: true },
    }),
    prisma.dolibarrCompany.create({
      data: { dolibarrId: `${PREFIX}-c2`, name: "ZZ Client Ordinaire", town: "Lyon" },
    }),
  ]);

  try {
    // 1) Lecture : réservée aux comptes qui gèrent le SAV.
    const anon = await fetch(`${BASE_URL}/api/dolibarr/directory/users`);
    check("Lecture sans session → 403", anon.status === 403, anon.status);

    // 2) Favoris seuls par défaut — la liste courte du quotidien.
    const favorites = await fetch(`${BASE_URL}/api/dolibarr/directory/users?favorites=1`, {
      headers: { cookie: adminCookie },
    }).then((r) => r.json());
    const favoriteNames = favorites.users.map((u: { name: string }) => u.name);
    check("Les favoris seuls sont renvoyés", favoriteNames.includes("Alain Favori"), favoriteNames);
    check("Un non-favori est exclu", !favoriteNames.includes("Bernard Ordinaire"));

    // 3) Une recherche porte sur tout le répertoire, favoris ou non.
    const search = await fetch(`${BASE_URL}/api/dolibarr/directory/users?favorites=1&q=Bernard`, {
      headers: { cookie: adminCookie },
    }).then((r) => r.json());
    check(
      "La recherche ignore le filtre favoris",
      search.users.some((u: { name: string }) => u.name === "Bernard Ordinaire"),
      search.users,
    );

    // 4) Ce qui est désactivé ou hors employés n'apparaît pas.
    const all = await fetch(`${BASE_URL}/api/dolibarr/directory/users?q=zz`, {
      headers: { cookie: adminCookie },
    }).then((r) => r.json());
    void all;
    const byName = await fetch(`${BASE_URL}/api/dolibarr/directory/users?q=Claude`, {
      headers: { cookie: adminCookie },
    }).then((r) => r.json());
    check("Un utilisateur désactivé est masqué", byName.users.length === 0, byName.users);

    const nonEmployee = await fetch(`${BASE_URL}/api/dolibarr/directory/users?q=Denise`, {
      headers: { cookie: adminCookie },
    }).then((r) => r.json());
    check("Un non-employé est masqué par défaut", nonEmployee.users.length === 0);
    const withNonEmployee = await fetch(
      `${BASE_URL}/api/dolibarr/directory/users?q=Denise&employees=0`,
      { headers: { cookie: adminCookie } },
    ).then((r) => r.json());
    check("…mais reste accessible sur demande", withNonEmployee.users.length === 1);

    // 5) Le manque de compte CRM est signalé (personne à notifier).
    check(
      "Un utilisateur sans compte CRM est signalé",
      favorites.users[0]?.hasCrmAccount === false,
      favorites.users[0],
    );
    await prisma.user.update({
      where: { id: viewer.id },
      data: { dolibarrUserId: `${PREFIX}-u1` },
    });
    const linked = await fetch(`${BASE_URL}/api/dolibarr/directory/users?favorites=1`, {
      headers: { cookie: adminCookie },
    }).then((r) => r.json());
    check("Un utilisateur rattaché est reconnu", linked.users[0]?.hasCrmAccount === true);

    // 6) Sociétés : mêmes règles, avec l'adresse composée.
    const companies = await fetch(`${BASE_URL}/api/dolibarr/directory/companies?favorites=1`, {
      headers: { cookie: adminCookie },
    }).then((r) => r.json());
    check("Sociétés favorites renvoyées", companies.companies.length === 1, companies.companies);
    check("L’adresse d’affichage est calculée", companies.companies[0]?.addressLabel === "Paris");

    // Le répertoire sert à *éditer* : un VIEWER, qui ne modifie rien, n'y a pas accès
    // (`canManageSav`, donc ADMIN/OPERATOR). Choix délibéré du moindre privilège — les noms de
    // sociétés qu'il a besoin de voir lui parviennent déjà par les SAV eux-mêmes.
    const viewerRead = await fetch(`${BASE_URL}/api/dolibarr/directory/companies?favorites=1`, {
      headers: { cookie: viewerCookie },
    });
    check("Un VIEWER n’accède pas au répertoire → 403", viewerRead.status === 403, viewerRead.status);

    // 7) Bascule de favori : ADMIN seulement.
    const viewerToggle = await fetch(
      `${BASE_URL}/api/dolibarr/directory/users?id=${plainUser.id}`,
      {
        method: "PATCH",
        headers: { cookie: viewerCookie, "Content-Type": "application/json" },
        body: JSON.stringify({ favorite: true }),
      },
    );
    check("Un VIEWER ne peut pas modifier les favoris → 403", viewerToggle.status === 403);

    const toggled = await fetch(`${BASE_URL}/api/dolibarr/directory/users?id=${plainUser.id}`, {
      method: "PATCH",
      headers: { cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ favorite: true }),
    });
    check("Un ADMIN bascule le favori → 200", toggled.status === 200);
    check(
      "Le favori est enregistré",
      (await prisma.dolibarrUser.findUnique({ where: { id: plainUser.id } }))?.favorite === true,
    );

    const ghost = await fetch(`${BASE_URL}/api/dolibarr/directory/users?id=inexistant`, {
      method: "PATCH",
      headers: { cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ favorite: true }),
    });
    check("Utilisateur inexistant → 404", ghost.status === 404, ghost.status);

    // 8) Le favori survit à une désactivation : c'est une donnée du CRM, pas de Dolibarr.
    await prisma.dolibarrUser.update({
      where: { id: favoriteUser.id },
      data: { active: false },
    });
    const stillFavorite = await prisma.dolibarrUser.findUnique({ where: { id: favoriteUser.id } });
    check("Le favori est conservé après désactivation", stillFavorite?.favorite === true);
    void inactiveUser;

    // 9) L'import exige des droits d'administration.
    const viewerImport = await fetch(`${BASE_URL}/api/settings/dolibarr/import`, {
      method: "POST",
      headers: { cookie: viewerCookie },
    });
    check("Import refusé à un VIEWER → 403", viewerImport.status === 403, viewerImport.status);
  } finally {
    await cleanup();
    console.log("\n· Entrées et comptes de test supprimés. Aucun appel à Dolibarr.");
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
