/**
 * Vérifie que l'export Excel produit un classeur réellement lisible.
 *
 *   npx tsx --env-file=.env scripts/test-excel-export.ts
 *
 * Le fichier téléchargé est **relu avec ExcelJS** : un octet de plus ou une signature ZIP ne
 * prouvent rien, seul un classeur qui se rouvre garantit qu'Excel l'ouvrira.
 */
import ExcelJS from "exceljs";
import { SignJWT } from "jose";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3005";

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

async function main() {
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

  const anonymous = await fetch(`${BASE_URL}/api/reports/export?type=worksheets&format=xlsx`);
  check("Sans session → 401", anonymous.status === 401, anonymous.status);

  for (const type of ["worksheets", "materials"] as const) {
    const response = await fetch(
      `${BASE_URL}/api/reports/export?type=${type}&format=xlsx`,
      { headers: { cookie } },
    );
    check(`${type} : réponse 200`, response.status === 200, response.status);
    check(
      `${type} : type MIME Excel`,
      (response.headers.get("content-type") ?? "").includes("spreadsheetml"),
      response.headers.get("content-type"),
    );
    check(
      `${type} : nom de fichier .xlsx`,
      (response.headers.get("content-disposition") ?? "").includes(".xlsx"),
      response.headers.get("content-disposition"),
    );

    const arrayBuffer = await response.arrayBuffer();
    const bytes = Buffer.from(arrayBuffer);
    // Un .xlsx est un ZIP : il commence par « PK ».
    check(`${type} : signature ZIP`, bytes.subarray(0, 2).toString() === "PK");

    // La vraie preuve : le classeur se rouvre.
    // Les @types/node récents rendent `Buffer` générique (`Buffer<ArrayBuffer>`), plus étroit que
    // celui attendu par les typages d'ExcelJS : le contenu est identique, seul le type diverge.
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    const sheet = workbook.worksheets[0];
    check(`${type} : le classeur se relit`, Boolean(sheet), workbook.worksheets.length);
    check(`${type} : en-tête présent`, (sheet?.getRow(1).cellCount ?? 0) > 0);
    check(`${type} : en-tête en gras`, sheet?.getRow(1).font?.bold === true);
    check(`${type} : filtres posés sur l’en-tête`, Boolean(sheet?.autoFilter));
    check(
      `${type} : colonnes élargies`,
      (sheet?.getColumn(1).width ?? 0) >= 10,
      sheet?.getColumn(1).width,
    );

    const headerValues = (sheet?.getRow(1).values as unknown[]) ?? [];
    console.log(`  · ${type} : ${sheet?.rowCount ?? 0} ligne(s), colonnes ${headerValues.slice(1).join(", ")}`);
  }

  // Le CSV doit continuer de fonctionner exactement comme avant.
  const csv = await fetch(`${BASE_URL}/api/reports/export?type=worksheets`, { headers: { cookie } });
  const csvBody = await csv.text();
  check("CSV toujours servi", csv.status === 200 && csvBody.includes(";"), csv.status);
  check(
    "CSV : nom de fichier .csv",
    (csv.headers.get("content-disposition") ?? "").includes(".csv"),
    csv.headers.get("content-disposition"),
  );

  console.log(`\n${failures === 0 ? "Tous les tests sont passés." : `${failures} test(s) en échec.`}`);
  await prisma.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
