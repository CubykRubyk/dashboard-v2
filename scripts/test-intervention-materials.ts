/**
 * Matériel à poser sur une intervention : ajout, retrait, documentation associée, cloisonnement.
 *
 *   npx tsx --env-file=.env scripts/test-intervention-materials.ts
 *
 * N'écrit jamais dans Dolibarr : l'intervention de test est locale (`dolibarrEventId` non
 * numérique), et les routes matériel ne touchent que la base de l'application.
 */
import { hash } from "bcryptjs";
import { SignJWT } from "jose";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { normalizeCatalogName, normalizeEquipmentReference } from "../src/lib/hvac/normalization";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3005";
const PREFIX = "ZZ-MAT";
const MANUFACTURER = "ZZ Matériel Test";

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
  const interventions = await prisma.interventionPlanning.findMany({
    where: { dolibarrEventId: { startsWith: PREFIX } },
    select: { id: true },
  });
  const ids = interventions.map((row) => row.id);
  if (ids.length > 0) {
    await prisma.interventionMaterial.deleteMany({ where: { interventionId: { in: ids } } });
    await prisma.interventionPlanning.deleteMany({ where: { id: { in: ids } } });
  }
  const manufacturer = await prisma.manufacturer.findFirst({ where: { name: MANUFACTURER } });
  if (manufacturer) {
    const equipment = await prisma.equipment.findMany({
      where: { manufacturerId: manufacturer.id },
      select: { id: true },
    });
    const equipmentIds = equipment.map((row) => row.id);
    if (equipmentIds.length > 0) {
      await prisma.interventionMaterial.deleteMany({ where: { equipmentId: { in: equipmentIds } } });
      await prisma.equipmentTechnicalDocument.deleteMany({
        where: { equipmentId: { in: equipmentIds } },
      });
      await prisma.technicalDocument.deleteMany({ where: { title: { startsWith: PREFIX } } });
      await prisma.auditLog.deleteMany({
        where: { entityType: "Equipment", entityId: { in: equipmentIds } },
      });
      await prisma.equipment.deleteMany({ where: { id: { in: equipmentIds } } });
    }
    await prisma.manufacturer.delete({ where: { id: manufacturer.id } }).catch(() => undefined);
  }
  await prisma.user.deleteMany({ where: { email: { startsWith: "zz-mat-test" } } });
}

async function main() {
  await cleanup();

  const admin = await prisma.user.findFirst({ where: { role: "ADMIN", active: true } });
  if (!admin) throw new Error("Aucun compte ADMIN actif.");
  const adminCookie = await cookieFor({ ...admin, role: "ADMIN" });

  const technician = await prisma.user.create({
    data: {
      email: "zz-mat-test-tech@test.local",
      name: "Tech Matériel",
      passwordHash: await hash("MotDePasseTest2026!", 12),
      role: "TECHNICIEN",
      dolibarrUserId: "996001",
    },
  });
  const technicianCookie = await cookieFor({ ...technician, role: "TECHNICIEN" });

  const manufacturer = await prisma.manufacturer.create({
    data: { name: MANUFACTURER, normalizedName: normalizeCatalogName(MANUFACTURER) },
  });
  const [pump, accessory] = await Promise.all([
    prisma.equipment.create({
      data: {
        manufacturerId: manufacturer.id,
        type: "MONOBLOC",
        name: "Pompe de test matériel",
        manufacturerReference: `${PREFIX}-POMPE-1`,
        normalizedReference: normalizeEquipmentReference(`${PREFIX}-POMPE-1`),
      },
    }),
    prisma.equipment.create({
      data: {
        manufacturerId: manufacturer.id,
        type: "ACCESSORY",
        name: "Accessoire de test",
        manufacturerReference: `${PREFIX}-ACC-1`,
        normalizedReference: normalizeEquipmentReference(`${PREFIX}-ACC-1`),
      },
    }),
  ]);

  // Un manuel rattaché à la pompe : c'est lui qui doit remonter avec la ligne de matériel.
  await prisma.technicalDocument.create({
    data: {
      title: `${PREFIX} Manuel pompe`,
      type: "INSTALLATION_MANUAL",
      originalFileName: "manuel.pdf",
      storageName: `${PREFIX}-${Date.now()}.pdf`,
      mimeType: "application/pdf",
      sizeBytes: 1024,
      isPrimary: true,
      equipment: { create: { equipmentId: pump.id } },
    },
  });

  // Intervention purement locale : aucune écriture Dolibarr possible.
  const intervention = await prisma.interventionPlanning.create({
    data: {
      dolibarrEventId: `${PREFIX}-${Date.now()}`,
      reference: "ZZ-MAT-1",
      title: "Intervention test matériel",
      dolibarrOwnerId: "996001",
      team: "Tech Matériel",
      startAt: new Date(),
    },
  });

  const url = `${BASE_URL}/api/planification-sav/interventions/${intervention.id}/materials`;

  try {
    // 1) Écriture réservée aux administrateurs.
    const techAdd = await fetch(url, {
      method: "POST",
      headers: { cookie: technicianCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ equipmentId: pump.id }),
    });
    check("Un technicien ne peut pas ajouter de matériel → 403", techAdd.status === 403, techAdd.status);

    const anonAdd = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ equipmentId: pump.id }),
    });
    check("Sans session → 403", anonAdd.status === 403, anonAdd.status);

    // 2) Ajout par un administrateur, avec la documentation qui suit.
    const added = await fetch(url, {
      method: "POST",
      headers: { cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ equipmentId: pump.id, quantity: 2 }),
    });
    const addedBody = await added.json();
    check("Ajout par un ADMIN → 201", added.status === 201, addedBody);
    check("La ligne est renvoyée", addedBody.materials?.length === 1, addedBody.materials?.length);
    check("La quantité est respectée", addedBody.materials?.[0]?.quantity === 2);
    check(
      "Le manuel de l’équipement accompagne la ligne",
      addedBody.materials?.[0]?.documents?.[0]?.title === `${PREFIX} Manuel pompe`,
      addedBody.materials?.[0]?.documents,
    );

    // 3) Rajouter le même équipement ajuste la quantité au lieu d'échouer.
    const again = await fetch(url, {
      method: "POST",
      headers: { cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ equipmentId: pump.id, quantity: 5 }),
    });
    const againBody = await again.json();
    check("Rajouter le même équipement n’échoue pas", again.status === 201, again.status);
    check("Une seule ligne subsiste", againBody.materials?.length === 1, againBody.materials?.length);
    check("La quantité a été ajustée", againBody.materials?.[0]?.quantity === 5);

    // 4) Un équipement sans documentation reste ajoutable (la doc est facultative).
    await fetch(url, {
      method: "POST",
      headers: { cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ equipmentId: accessory.id }),
    });

    // 5) Le technicien **lit** la liste : c'est tout l'intérêt sur le terrain.
    const techRead = await fetch(url, { headers: { cookie: technicianCookie } });
    const techBody = await techRead.json();
    check("Le technicien peut lire le matériel → 200", techRead.status === 200, techRead.status);
    check("Il voit les deux lignes", techBody.materials?.length === 2, techBody.materials?.length);
    check(
      "Il a accès aux manuels",
      techBody.materials?.some((m: { documents: unknown[] }) => m.documents.length > 0),
    );

    // 6) Un équipement inexistant est refusé proprement.
    const unknown = await fetch(url, {
      method: "POST",
      headers: { cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ equipmentId: "equipement-inexistant" }),
    });
    check("Équipement inconnu → 400", unknown.status === 400, unknown.status);

    // 7) Le catalogue protège l'historique : impossible de supprimer une référence posée.
    let blocked = false;
    try {
      await prisma.equipment.delete({ where: { id: pump.id } });
    } catch {
      blocked = true;
    }
    check("Supprimer du catalogue un équipement posé est refusé", blocked);

    // 8) Retrait d'une ligne, par un administrateur seulement.
    const materialId = techBody.materials[0].id;
    const techDelete = await fetch(`${url}?materialId=${materialId}`, {
      method: "DELETE",
      headers: { cookie: technicianCookie },
    });
    check("Un technicien ne peut pas retirer une ligne → 403", techDelete.status === 403);

    const removed = await fetch(`${url}?materialId=${materialId}`, {
      method: "DELETE",
      headers: { cookie: adminCookie },
    });
    const removedBody = await removed.json();
    check("Retrait par un ADMIN → 200", removed.status === 200, removed.status);
    check("Il ne reste qu’une ligne", removedBody.materials?.length === 1);

    const ghost = await fetch(`${url}?materialId=ligne-inexistante`, {
      method: "DELETE",
      headers: { cookie: adminCookie },
    });
    check("Retrait d’une ligne inexistante → 404", ghost.status === 404, ghost.status);

    // 9) Recherche d'équipement (alimente le sélecteur).
    const search = await fetch(
      `${BASE_URL}/api/pac/technical/equipment/search?q=${encodeURIComponent(`${PREFIX}-POMPE`)}`,
      { headers: { cookie: adminCookie } },
    );
    const searchBody = await search.json();
    check("La recherche d’équipement répond", search.status === 200);
    check(
      "La pompe de test est trouvée",
      searchBody.equipment?.some((e: { reference: string }) => e.reference === `${PREFIX}-POMPE-1`),
      searchBody.equipment?.length,
    );
  } finally {
    await cleanup();
    console.log("\n· Intervention, catalogue et comptes de test supprimés.");
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
