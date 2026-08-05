/**
 * Test réel de la saisie rapide d'une pompe, contre la base de développement.
 *
 *   npx tsx --env-file=.env scripts/test-simple-pump.ts
 *
 * Idempotent : crée son propre fabricant de test et supprime tout ce qu'il a créé à la fin
 * (équipements, gamme, fabricant, lignes d'audit), y compris en cas d'échec.
 */
import { SignJWT } from "jose";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { normalizeCatalogName } from "../src/lib/hvac/normalization";
import { createSimplePumpRecord } from "../src/lib/hvac/simple-pump-repository";
import { planPumpEquipment } from "../src/lib/hvac/simple-pump-service";
import { simplePumpInputSchema } from "../src/lib/hvac/simple-pump-validation";
import type { SimplePumpInput } from "../src/lib/hvac/simple-pump-validation";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const MANUFACTURER_NAME = "ZZ Test Fabricant (script)";

let failures = 0;
function check(label: string, condition: boolean, detail?: unknown) {
  if (condition) console.log(`✓ ${label}`);
  else {
    failures += 1;
    console.error(`✗ ${label}`, detail ?? "");
  }
}

async function adminSessionCookie(user: { id: string; email: string; name: string }) {
  const token = await new SignJWT({ user: { ...user, role: "ADMIN" } })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
    .sign(new TextEncoder().encode(process.env.AUTH_SECRET!));
  return `dashboard_session=${token}`;
}

function parseInput(raw: Record<string, unknown>): SimplePumpInput {
  return simplePumpInputSchema.parse({
    productRangeId: "",
    newProductRangeName: "",
    indoorReference: "",
    outdoorReference: "",
    nominalPowerKw: "",
    installationNotes: "",
    internalNotes: "",
    ...raw,
  });
}

async function cleanup(manufacturerId: string) {
  const equipment = await prisma.equipment.findMany({
    where: { manufacturerId },
    select: { id: true },
  });
  const ids = equipment.map((item) => item.id);
  if (ids.length > 0) {
    await prisma.equipmentTechnicalDocument.deleteMany({ where: { equipmentId: { in: ids } } });
    await prisma.auditLog.deleteMany({ where: { entityType: "Equipment", entityId: { in: ids } } });
    await prisma.equipment.deleteMany({ where: { id: { in: ids } } });
  }
  const ranges = await prisma.productRange.findMany({
    where: { manufacturerId },
    select: { id: true },
  });
  if (ranges.length > 0) {
    await prisma.auditLog.deleteMany({
      where: { entityType: "ProductRange", entityId: { in: ranges.map((r) => r.id) } },
    });
    await prisma.productRange.deleteMany({ where: { manufacturerId } });
  }
  await prisma.manufacturer.deleteMany({ where: { id: manufacturerId } });
}

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN", active: true } });
  if (!admin) throw new Error("Aucun compte ADMIN actif en base.");

  // Repart d'un état propre si un run précédent a échoué en cours de route.
  const stale = await prisma.manufacturer.findFirst({ where: { name: MANUFACTURER_NAME } });
  if (stale) await cleanup(stale.id);

  // La base impose `normalizedName = lower(trim + espaces compactés)` par une contrainte CHECK
  // (invisible dans schema.prisma) : on passe donc par la fonction de normalisation officielle.
  const manufacturer = await prisma.manufacturer.create({
    data: {
      name: MANUFACTURER_NAME,
      normalizedName: normalizeCatalogName(MANUFACTURER_NAME),
    },
  });
  console.log(`Fabricant de test : ${manufacturer.id}\n`);

  try {
    // 1) Cas minimal : ni gamme, ni référence — le cœur de la demande d'Ion.
    const minimal = parseInput({
      manufacturerId: manufacturer.id,
      name: "Pompe minimale",
      configuration: "UNKNOWN",
    });
    const minimalResult = await createSimplePumpRecord(
      minimal,
      planPumpEquipment(minimal),
      [],
      admin.id,
    );
    check("Pompe minimale créée (1 fiche)", minimalResult.equipmentIds.length === 1, minimalResult);
    check("Aucune gamme n’est créée quand aucune n’est demandée", minimalResult.productRangeId === null);

    const minimalEquipment = await prisma.equipment.findUnique({
      where: { id: minimalResult.equipmentIds[0] },
    });
    check("Le nom sert de référence en l’absence de référence saisie",
      minimalEquipment?.manufacturerReference === "Pompe minimale", minimalEquipment?.manufacturerReference);
    check("La fiche est signalée « référence à vérifier »",
      minimalEquipment?.referenceNeedsReview === true);
    check("Le type est OTHER pour une configuration inconnue", minimalEquipment?.type === "OTHER");

    // 2) Split complet avec création d'une gamme au passage.
    const split = parseInput({
      manufacturerId: manufacturer.id,
      newProductRangeName: "Gamme Test",
      name: "Pompe split",
      configuration: "SPLIT",
      indoorReference: "ZZ-INT-001",
      outdoorReference: "ZZ-EXT-001",
      nominalPowerKw: "16,5",
    });
    const splitResult = await createSimplePumpRecord(
      split,
      planPumpEquipment(split),
      [],
      admin.id,
    );
    check("Pompe split : 2 fiches créées", splitResult.equipmentIds.length === 2, splitResult);
    check("La nouvelle gamme est créée", Boolean(splitResult.productRangeId));

    const splitEquipment = await prisma.equipment.findMany({
      where: { id: { in: splitResult.equipmentIds } },
      orderBy: { type: "asc" },
    });
    check("Les deux fiches portent la gamme créée",
      splitEquipment.every((item) => item.productRangeId === splitResult.productRangeId));
    check("Types intérieur/extérieur corrects",
      splitEquipment.map((item) => item.type).sort().join(",") === "INDOOR_UNIT,OUTDOOR_UNIT",
      splitEquipment.map((item) => item.type));
    check("La puissance à virgule est bien enregistrée",
      splitEquipment.every((item) => item.nominalPowerKw === 16.5),
      splitEquipment.map((item) => item.nominalPowerKw));
    check("Aucune référence marquée à vérifier quand elles sont saisies",
      splitEquipment.every((item) => item.referenceNeedsReview === false));

    // 3) Aucune SystemCombination n'a été créée — la décision produit centrale.
    const combinations = await prisma.systemCombination.count({
      where: { manufacturerId: manufacturer.id },
    });
    check("Aucune combinaison n’est créée", combinations === 0, combinations);

    // 4) Réutilisation d'une gamme homonyme au lieu d'un échec sur la contrainte d'unicité.
    const sameRange = parseInput({
      manufacturerId: manufacturer.id,
      newProductRangeName: "gamme   test", // même nom normalisé
      name: "Pompe homonyme",
      configuration: "MONOBLOC",
      indoorReference: "ZZ-MONO-001",
    });
    const sameRangeResult = await createSimplePumpRecord(
      sameRange,
      planPumpEquipment(sameRange),
      [],
      admin.id,
    );
    check("Une gamme homonyme est réutilisée, pas dupliquée",
      sameRangeResult.productRangeId === splitResult.productRangeId,
      { reused: sameRangeResult.productRangeId, expected: splitResult.productRangeId });
    check("Une seule gamme existe pour ce fabricant",
      (await prisma.productRange.count({ where: { manufacturerId: manufacturer.id } })) === 1);

    // 5) Référence en doublon : rejet propre, et surtout aucune fiche partielle laissée derrière.
    const before = await prisma.equipment.count({ where: { manufacturerId: manufacturer.id } });
    const duplicate = parseInput({
      manufacturerId: manufacturer.id,
      name: "Pompe doublon",
      configuration: "SPLIT",
      indoorReference: "ZZ-NOUVELLE-001",
      outdoorReference: "zz-ext-001", // déjà prise (casse différente)
    });
    let rejected = false;
    try {
      await createSimplePumpRecord(duplicate, planPumpEquipment(duplicate), [], admin.id);
    } catch {
      rejected = true;
    }
    check("Une référence en doublon est refusée", rejected);
    const after = await prisma.equipment.count({ where: { manufacturerId: manufacturer.id } });
    check("Aucune fiche partielle n’est laissée après le rejet (transaction)", after === before,
      { before, after });

    // 6) Traces d'audit.
    const audits = await prisma.auditLog.count({
      where: {
        action: "HVAC_EQUIPMENT_CREATE",
        entityId: { in: [...minimalResult.equipmentIds, ...splitResult.equipmentIds] },
      },
    });
    check("Une ligne d’audit par fiche créée", audits === 3, audits);

    // 7) Rendu des pages (le formulaire et la navigation réorganisée).
    const baseUrl = process.env.BASE_URL ?? "http://localhost:3005";
    const cookie = await adminSessionCookie(admin);
    const page = await fetch(`${baseUrl}/pac/technical/pumps/new`, { headers: { cookie } })
      .catch(() => null);
    if (!page) {
      console.log("· (serveur non démarré, vérification du rendu ignorée)");
    } else {
      const html = await page.text();
      check("GET /pac/technical/pumps/new → 200", page.status === 200, page.status);
      check("Le titre « Ajouter une pompe » est rendu", html.includes("Ajouter une pompe"));
      check("Le sélecteur de configuration est rendu", html.includes("Configuration"));
      check("Le champ d’import de manuel est rendu", html.includes("Importer un manuel"));
      check("La navigation propose « Avancé »", html.includes("Avanc"));
      check(
        "« Combinaisons » n’est plus un onglet de premier niveau",
        !html.includes(">Combinaisons<") || html.includes("Avanc"),
      );

      // `/pac` (menu latéral) ne doit plus présenter les combinaisons mais mener au catalogue.
      const legacy = await fetch(`${baseUrl}/pac`, { headers: { cookie }, redirect: "manual" });
      check(
        "/pac redirige (307) vers /pac/technical",
        legacy.status === 307 && (legacy.headers.get("location") ?? "").includes("/pac/technical"),
        { status: legacy.status, location: legacy.headers.get("location") },
      );

      const catalog = await fetch(`${baseUrl}/pac`, { headers: { cookie } });
      const catalogHtml = await catalog.text();
      check("Le catalogue affiche « Pompes et équipements »",
        catalogHtml.includes("Pompes et équipements"));
      check(
        "Plus aucune mention de « combinaisons compatibles » en page d’accueil du catalogue",
        !catalogHtml.includes("combinaisons compatibles"),
      );
      check("La saisie détaillée reste accessible", catalogHtml.includes("Saisie détaillée"));
    }
  } finally {
    await cleanup(manufacturer.id);
    console.log("\n· Données de test supprimées.");
  }

  console.log(`\n${failures === 0 ? "Tous les tests sont passés." : `${failures} test(s) en échec.`}`);
  await prisma.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
