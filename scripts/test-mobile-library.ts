/**
 * Bibliothèque technique mobile : recherche et accès aux manuels.
 *
 *   npx tsx --env-file=.env scripts/test-mobile-library.ts
 *
 * Crée un fabricant, un équipement et un document de test (avec un vrai PDF sur disque), vérifie
 * la recherche, l'accès du technicien au fichier, puis supprime tout.
 */
import { randomUUID } from "node:crypto";
import { rm, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

import { hash } from "bcryptjs";
import { SignJWT } from "jose";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { normalizeCatalogName, normalizeEquipmentReference } from "../src/lib/hvac/normalization";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3005";
const MANUFACTURER = "ZZ Biblio Test";
const REFERENCE = "ZZ-BIB-4200 XK";

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

function documentRoot() {
  return (
    process.env.TECHNICAL_DOCUMENT_STORAGE_ROOT?.trim()
    || path.join(process.cwd(), "data", "pac-documents")
  );
}

async function cleanup(storageName?: string) {
  const manufacturer = await prisma.manufacturer.findFirst({ where: { name: MANUFACTURER } });
  if (manufacturer) {
    const equipment = await prisma.equipment.findMany({
      where: { manufacturerId: manufacturer.id },
      select: { id: true },
    });
    const ids = equipment.map((item) => item.id);
    if (ids.length > 0) {
      const links = await prisma.equipmentTechnicalDocument.findMany({
        where: { equipmentId: { in: ids } },
        select: { technicalDocumentId: true },
      });
      await prisma.equipmentTechnicalDocument.deleteMany({ where: { equipmentId: { in: ids } } });
      const documentIds = links.map((link) => link.technicalDocumentId);
      if (documentIds.length > 0) {
        const docs = await prisma.technicalDocument.findMany({
          where: { id: { in: documentIds } },
          select: { storageName: true },
        });
        for (const doc of docs) {
          await rm(path.join(documentRoot(), doc.storageName), { force: true }).catch(() => undefined);
        }
        await prisma.technicalDocument.deleteMany({ where: { id: { in: documentIds } } });
      }
      await prisma.auditLog.deleteMany({ where: { entityType: "Equipment", entityId: { in: ids } } });
      await prisma.equipment.deleteMany({ where: { id: { in: ids } } });
    }
    await prisma.manufacturer.delete({ where: { id: manufacturer.id } }).catch(() => undefined);
  }
  if (storageName) {
    await rm(path.join(documentRoot(), storageName), { force: true }).catch(() => undefined);
  }
  await prisma.user.deleteMany({ where: { email: { startsWith: "zz-biblio-test" } } });
}

async function main() {
  await cleanup();

  const passwordHash = await hash("MotDePasseTest2026!", 12);
  const technician = await prisma.user.create({
    data: {
      email: "zz-biblio-test@test.local",
      name: "Tech Biblio",
      passwordHash,
      role: "TECHNICIEN",
      dolibarrUserId: "994001",
    },
  });

  const manufacturer = await prisma.manufacturer.create({
    data: { name: MANUFACTURER, normalizedName: normalizeCatalogName(MANUFACTURER) },
  });
  const equipment = await prisma.equipment.create({
    data: {
      manufacturerId: manufacturer.id,
      type: "MONOBLOC",
      name: "Pompe de test bibliothèque",
      manufacturerReference: REFERENCE,
      normalizedReference: normalizeEquipmentReference(REFERENCE),
    },
  });

  // PDF minimal mais valide (la route vérifie la signature `%PDF-` à l'écriture).
  const storageName = `${randomUUID()}.pdf`;
  const pdfBytes = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n");
  await mkdir(documentRoot(), { recursive: true });
  await writeFile(path.join(documentRoot(), storageName), pdfBytes);

  const document = await prisma.technicalDocument.create({
    data: {
      title: "Manuel d’installation ZZ-BIB",
      type: "INSTALLATION_MANUAL",
      originalFileName: "manuel-zz-bib.pdf",
      storageName,
      mimeType: "application/pdf",
      sizeBytes: pdfBytes.byteLength,
      isPrimary: true,
      equipment: { create: { equipmentId: equipment.id } },
    },
  });

  try {
    const cookie = await cookieFor({ ...technician, role: "TECHNICIEN" });

    // 1) Un technicien accède à la bibliothèque (la permission a été élargie pour ça).
    const page = await fetch(`${BASE_URL}/mobile/bibliotheque`, { headers: { cookie }, redirect: "manual" });
    check("Un TECHNICIEN accède à la bibliothèque → 200", page.status === 200, page.status);
    const emptyHtml = await page.text();
    check("Sans recherche, l’invite est affichée", emptyHtml.includes("2 caract"));
    check("L’onglet Docs est présent dans la barre", emptyHtml.includes("Docs"));

    // 2) Recherche par référence exacte.
    const byReference = await fetch(
      `${BASE_URL}/mobile/bibliotheque?q=${encodeURIComponent("ZZ-BIB-4200")}`,
      { headers: { cookie } },
    );
    const referenceHtml = await byReference.text();
    check("Recherche par référence → équipement trouvé", referenceHtml.includes(REFERENCE));
    check("Le manuel associé est listé", referenceHtml.includes("Manuel d’installation ZZ-BIB"));

    // 3) Référence tapée sans espaces et en minuscules : c'est exactement ce que
    // `normalizeEquipmentReference` neutralise (espaces + casse), et c'est la frappe typique sur
    // un téléphone. Les tirets, eux, restent significatifs : la contrainte CHECK en base impose
    // cette normalisation précise, on ne l'élargit pas pour la seule recherche.
    const sloppy = await fetch(
      `${BASE_URL}/mobile/bibliotheque?q=${encodeURIComponent("zz-bib-4200xk")}`,
      { headers: { cookie } },
    );
    check("Recherche insensible aux espaces et à la casse",
      (await sloppy.text()).includes(REFERENCE));

    // 4) Recherche par fabricant.
    const byManufacturer = await fetch(
      `${BASE_URL}/mobile/bibliotheque?q=${encodeURIComponent("ZZ Biblio")}`,
      { headers: { cookie } },
    );
    check("Recherche par fabricant → équipement trouvé",
      (await byManufacturer.text()).includes(REFERENCE));

    // 5) Recherche sans résultat.
    const nothing = await fetch(
      `${BASE_URL}/mobile/bibliotheque?q=${encodeURIComponent("xyzintrouvable")}`,
      { headers: { cookie } },
    );
    check("Recherche infructueuse → message dédié",
      (await nothing.text()).includes("Aucun résultat"));

    // 6) Le PDF est réellement servi au technicien (permission élargie côté route aussi).
    const file = await fetch(`${BASE_URL}/api/pac/technical/documents/${document.id}`, {
      headers: { cookie },
    });
    check("Le PDF est servi au technicien → 200", file.status === 200, file.status);
    check("Le type de contenu est un PDF",
      (file.headers.get("content-type") ?? "").includes("pdf"), file.headers.get("content-type"));
    const bytes = Buffer.from(await file.arrayBuffer());
    check("Le contenu est bien le PDF attendu", bytes.subarray(0, 5).toString() === "%PDF-");

    // 7) Sans session, rien n'est accessible.
    const anonymousFile = await fetch(`${BASE_URL}/api/pac/technical/documents/${document.id}`);
    check("PDF inaccessible sans session → 401", anonymousFile.status === 401, anonymousFile.status);
  } finally {
    await cleanup(storageName);
    console.log("\n· Fabricant, équipement, document et compte de test supprimés.");
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
