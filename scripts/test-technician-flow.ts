// Test manuel, ponctuel — simule le parcours complet d'un technicien mobile : compte, intervention,
// fiche complétée avec photos. Ne supprime rien (demandé explicitement) — voir le résumé affiché en
// fin d'exécution pour les identifiants et l'URL de la fiche.
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { hash } from "bcryptjs";
import { SignJWT } from "jose";
import sharp from "sharp";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, UserRole } from "../src/generated/prisma/client";

const BASE_URL = "http://localhost:3000";
const COOKIE_NAME = "dashboard_session";
const PHOTO_COUNT = 15;

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET doit contenir au moins 32 caractères.");
  return new TextEncoder().encode(secret);
}

async function main() {
  // 1) Compte technicien de test (rôle OPERATOR — TECHNICIEN n'a aujourd'hui aucune permission et
  // serait rejeté à la porte de /mobile, gap déjà connu et documenté).
  const email = "technicien.test@2cenergies.local";
  const password = "TestTechnicien2026!";
  const passwordHash = await hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: UserRole.OPERATOR, active: true, name: "Technicien Test" },
    create: { email, name: "Technicien Test", passwordHash, role: UserRole.OPERATOR },
  });
  console.log(`✓ Utilisateur de test : ${email} (id ${user.id})`);

  // Idempotent : un run précédent laisse parfois une fiche de test (ex. échec avant "complete").
  // La cascade Prisma supprime les lignes WorkSheetPhoto en base, mais pas les fichiers sur disque
  // (pas grave pour un script de test en dev — pas de nettoyage disque ici, volontairement simple).
  await prisma.workSheet.deleteMany({ where: { createdById: user.id } });

  // La base locale n'a aucun tag existant — la fiche exige au moins un tag pour passer en
  // COMPLETED (`finalizationErrors`), donc on en réutilise un de test (upsert, idempotent) plutôt
  // que d'échouer ou de laisser la fiche bloquée en DRAFT.
  let tag = await prisma.tag.findFirst({ where: { active: true } });
  if (!tag) {
    tag = await prisma.tag.upsert({
      where: { name: "Test" },
      update: { active: true },
      create: { name: "Test", color: "#316aff", active: true },
    });
    console.log(`✓ Aucun tag actif trouvé — tag "Test" créé (id ${tag.id})`);
  }

  // 2) Intervention de test — insérée localement dans InterventionPlanning (jamais dans Dolibarr,
  // qui reste strict read-only). `dolibarrEventId` volontairement non-numérique : même si quelqu'un
  // cliquait "Envoyer vers Dolibarr" sur la fiche générée, l'appel échouerait proprement (ID
  // invalide côté Dolibarr) plutôt que de risquer de toucher un vrai événement.
  // Idempotent : un run précédent (interrompu par une erreur avant la création de la fiche, par
  // exemple) ne doit pas laisser d'intervention de test orpheline à chaque nouvel essai.
  await prisma.interventionPlanning.deleteMany({ where: { reference: "TEST-INT-001" } });

  const fakeEventId = `TEST-${randomUUID().slice(0, 8)}`;
  const today = new Date();
  const startAt = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 9, 0, 0));
  const intervention = await prisma.interventionPlanning.create({
    data: {
      dolibarrEventId: fakeEventId,
      reference: "TEST-INT-001",
      title: "TEST — Remplacement chaudière",
      company: "Client Test SARL",
      address: "12 rue de Test, 75000 Paris",
      startAt,
      endAt: startAt,
      team: "Équipe Test",
      color: "#316aff",
      status: "OUVERT",
    },
  });
  console.log(`✓ Intervention de test créée (id ${intervention.id}, dolibarrEventId ${fakeEventId})`);

  // 3) Session valide — un JWT signé avec le même secret que l'appli, au lieu de rejouer le
  // Server Action de login (protocole interne, pas une simple route POST).
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  const token = await new SignJWT({ user: { id: user.id, email: user.email, name: user.name, role: user.role } })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(secretKey());
  const cookieHeader = `${COOKIE_NAME}=${token}`;

  // 4) Matériel réel du catalogue, pour une fiche réaliste (pas juste des champs vides). Les
  // matériaux de type SELECT exigent un `variantId` valide (vérifié côté route) — on prend leur
  // première variante ; les autres types n'en ont pas besoin (chaîne vide).
  const candidateMaterials = await prisma.material.findMany({
    where: { active: true },
    include: { variants: true },
  });
  const materials = candidateMaterials
    .filter((material) => material.inputType !== "SELECT" || material.variants.length > 0)
    .slice(0, 2);

  // 5) POST /api/fiches — exactement le payload envoyé par FinishScreen.tsx (mobile), avec les
  // valeurs qu'aurait cet item d'intervention (workDate/client/company/installer/eventId).
  const createRes = await fetch(`${BASE_URL}/api/fiches`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookieHeader },
    body: JSON.stringify({
      workDate: startAt.toISOString().slice(0, 10),
      client: intervention.company,
      company: intervention.company,
      installer: intervention.team,
      eventId: intervention.dolibarrEventId,
      mainInstallations: "",
      installations: [],
      otherMaterials: "",
      reportText:
        "Remplacement effectué sans incident, mise en service validée avec le client. " +
        "Ancienne chaudière déposée et évacuée. Réglages de la courbe de chauffe transmis au client.",
      reportFrozen: false,
      tagIds: tag ? [tag.id] : [],
      selections: materials.map((material) => ({
        materialId: material.id,
        selected: true,
        variantId: material.inputType === "SELECT" ? material.variants[0]?.id || "" : "",
        quantity: material.defaultQuantity || 1,
        detailValue: 0,
        supplier: "INTERNAL" as const,
        installed: true,
      })),
    }),
  });
  const created = await createRes.json().catch(() => null);
  if (!createRes.ok || !created?.id) {
    throw new Error(`Création de la fiche échouée (${createRes.status}) : ${JSON.stringify(created)}`);
  }
  const worksheetId: string = created.id;
  console.log(`✓ Fiche créée (id ${worksheetId}, status DRAFT)`);

  // 6) Photos — générées avec `sharp` (déjà une dépendance du projet, jamais utilisée jusqu'ici),
  // jpeg/png/webp variés pour vérifier que la galerie affiche bien plusieurs formats, pas de HEIC
  // ici (impossible à générer facilement sans device réel — le comportement HEIC est déjà couvert
  // par le fallback "aperçu indisponible" dans PhotoGallery.tsx).
  const hues = [10, 200, 140, 280, 40];
  let uploaded = 0;
  for (let i = 0; i < PHOTO_COUNT; i++) {
    const hue = hues[i % hues.length];
    const rgb = hslToRgb(hue, 55, 45 + (i % 3) * 5);
    const format = i % 3 === 0 ? "png" : i % 3 === 1 ? "webp" : "jpeg";
    const buffer = await sharp({
      create: { width: 640, height: 480, channels: 3, background: rgb },
    })
      [format]()
      .toBuffer();

    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(buffer)], { type: `image/${format}` }), `test-photo-${String(i + 1).padStart(2, "0")}.${format}`);
    form.append("label", `Photo test ${i + 1}`);

    const res = await fetch(`${BASE_URL}/api/fiches/${worksheetId}/photos`, {
      method: "POST",
      headers: { Cookie: cookieHeader },
      body: form,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(`Upload photo ${i + 1} échoué (${res.status}) : ${JSON.stringify(body)}`);
    }
    uploaded++;
  }
  console.log(`✓ ${uploaded} photos envoyées (jpeg/png/webp mélangées)`);

  // 7) Le technicien marque la fiche terminée (DRAFT → COMPLETED) — dernière étape de son flux,
  // avant qu'Ion ne la revoie et décide de l'envoyer ou non vers Dolibarr (jamais fait ici).
  const completeRes = await fetch(`${BASE_URL}/api/fiches/${worksheetId}/complete`, {
    method: "POST",
    headers: { Cookie: cookieHeader },
  });
  const completeBody = await completeRes.json().catch(() => null);
  if (!completeRes.ok) {
    console.warn(`⚠ Marquage COMPLETED échoué (${completeRes.status}) : ${JSON.stringify(completeBody)} — fiche laissée en DRAFT.`);
  } else {
    console.log("✓ Fiche marquée COMPLETED");
  }

  console.log("\n──────── Résumé ────────");
  console.log(`Compte technicien : ${email} / ${password} (rôle OPERATOR)`);
  console.log(`Intervention test  : ${intervention.reference} — ${intervention.title}`);
  console.log(`Fiche de chantier  : ${BASE_URL}/fiches/${worksheetId}`);
  console.log(`Photos             : ${uploaded} (formats mélangés jpeg/png/webp)`);
  console.log("Rien n'a été supprimé — fiche, intervention, compte et photos restent en place.");
}

function hslToRgb(h: number, s: number, l: number) {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return { r: Math.round(f(0) * 255), g: Math.round(f(8) * 255), b: Math.round(f(4) * 255) };
}

main()
  .catch((error) => {
    console.error("✗ Échec du test :", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
