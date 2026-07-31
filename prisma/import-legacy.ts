import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DatabaseSync } = require("node:sqlite") as {
  DatabaseSync: new (path: string, options: { readOnly: boolean }) => {
    prepare: (sql: string) => { all: () => Record<string, unknown>[] };
    close: () => void;
  };
};

const source = process.env.LEGACY_DATABASE_PATH;
const connectionString = process.env.DATABASE_URL;
if (!source || !connectionString) throw new Error("LEGACY_DATABASE_PATH et DATABASE_URL sont obligatoires.");

const sqlite = new DatabaseSync(source, { readOnly: true });
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const parse = <T>(value: unknown, fallback: T): T => {
  try { return JSON.parse(String(value || "")) as T; } catch { return fallback; }
};
const number = (value: unknown) => Number(value) || 0;

const equipmentKeys: Record<string, string> = {
  pot: "pot", disconnecteur: "disconnecteur", soupape: "soupape",
  vase18: "vase18", support18: "support18", vanne: "vanne",
  coupure: "coupure", antigel: "antigel", desembouage: "desembouage",
  dalle: "dalle", vase12: "vase12", support12: "support12",
  trepied_ballon: "trepied_ballon", mitigeur: "mitigeur", reducteur: "reducteur",
  pompe: "pompe", sup_mural: "support_mural", sup_sol: "support_sol",
  filtre: "filtre", rep4p: "repartiteur_tri", rep2p: "repartiteur_mono",
  clapet2634: "clapet2634", clapet2027: "clapet2027", mufe: "mufe",
  kit_ssc_fhe: "kit_ssc", bitube_inox: "bitube_inox",
  passe_cables_solaire: "passe_cables", vase35: "vase35", support35: "support35",
  vmc: "vmc_install", vmr: "vmr_install",
};
const measuredGroups = ["cables", "liaisons", "isolation", "multicouche", "raccords", "vmc"] as const;
const measuredAliases: Record<string, string> = {
  gain_d80: "gaine_d80", gain_d125: "gaine_d125", gain_d160: "gaine_d160",
};

async function main() {
  const user = await prisma.user.findFirst({ where: { active: true }, orderBy: { createdAt: "asc" } });
  if (!user) throw new Error("Créez d’abord un utilisateur administrateur.");
  const [materials, legacyTags, legacyFiches] = await Promise.all([
    prisma.material.findMany({ include: { category: true, variants: true } }),
    Promise.resolve(sqlite.prepare("SELECT id, name, color FROM Tag").all()),
    Promise.resolve(sqlite.prepare('SELECT * FROM Fiche WHERE deletedAt IS NULL ORDER BY date ASC').all()),
  ]);
  const materialByKey = new Map(materials.map((item) => [item.key, item]));
  const tagMap = new Map<string, string>();
  for (const [position, oldTag] of legacyTags.entries()) {
    const tag = await prisma.tag.upsert({
      where: { name: String(oldTag.name) },
      update: { color: String(oldTag.color || "#6c757d"), active: true },
      create: { name: String(oldTag.name), color: String(oldTag.color || "#6c757d"), position },
    });
    tagMap.set(String(oldTag.id), tag.id);
  }

  let imported = 0;
  for (const row of legacyFiches) {
    const equipment = parse<Record<string, unknown>>(row.equipment, {});
    const selected = new Map<string, { quantity: number; detail?: number; variant?: string }>();
    for (const [oldKey, newKey] of Object.entries(equipmentKeys)) {
      const value = equipment[oldKey];
      if (value === true || number(value) > 0) {
        selected.set(newKey, {
          quantity: number(equipment[`${oldKey}_qty`]) || number(value) || 1,
          detail: oldKey === "desembouage" ? number(equipment.radiateurs) : oldKey === "dalle" ? number(equipment.dalle_sacs) : undefined,
        });
      }
    }
    if (equipment.bm30) selected.set("bouteille_melange", { quantity: 1, variant: "30 L" });
    if (equipment.bm50) selected.set("bouteille_melange", { quantity: 1, variant: "50 L" });
    if (equipment.bm100) selected.set("bouteille_melange", { quantity: 1, variant: "100 L" });
    if (equipment.thermostat) selected.set("thermostat", { quantity: 1, variant: String(equipment.thermostat) });
    if (equipment.circulateur) selected.set("circulateur", { quantity: 1, variant: String(equipment.circulateur) });
    for (const group of measuredGroups) {
      const values = parse<Record<string, unknown>>(row[group], {});
      for (const [key, value] of Object.entries(values)) {
        if (number(value) > 0) selected.set(measuredAliases[key] || key, { quantity: number(value) });
      }
    }
    const tagIds = parse<string[]>(row.tags, []).map((id) => tagMap.get(id)).filter((id): id is string => Boolean(id));
    const itemData = [...selected.entries()].flatMap(([key, selection], position) => {
      const material = materialByKey.get(key);
      if (!material) return [];
      const normalizedVariant = selection.variant?.toLowerCase().replaceAll("_", " ");
      const variant = material.variants.find((item) =>
        item.name.toLowerCase() === normalizedVariant ||
        item.name.toLowerCase().includes(normalizedVariant || "__"),
      );
      return [{
        materialId: material.id,
        variantId: variant?.id,
        categoryNameSnapshot: material.category.name,
        materialNameSnapshot: material.name,
        reportLabelSnapshot: material.reportLabel,
        variantNameSnapshot: variant?.name,
        variantReportSnapshot: variant?.reportLabel,
        unitSnapshot: material.unit,
        quantity: selection.quantity,
        detailValue: selection.detail,
        supplier: "INTERNAL" as const,
        installed: true,
        position,
      }];
    });
    const workDate = row.date ? new Date(String(row.date)) : null;
    const createdAt = row.createdAt ? new Date(String(row.createdAt)) : new Date();
    await prisma.workSheet.upsert({
      where: { legacyId: String(row.id) },
      update: {},
      create: {
        legacyId: String(row.id),
        workDate: workDate && !Number.isNaN(workDate.getTime()) ? workDate : null,
        client: String(row.client || ""),
        company: String(row.societe || ""),
        installer: String(row.installateur || ""),
        eventId: String(row.eventId || "") || null,
        mainInstallations: String(row.resumeInstall || ""),
        otherMaterials: String(row.autres || ""),
        reportText: String(row.reportText || ""),
        reportFrozen: Boolean(row.reportFrozen),
        status: row.sentToDolibarr ? "SENT" : "COMPLETED",
        dolibarrSentAt: row.sentToDolibarr ? (row.updatedAt ? new Date(String(row.updatedAt)) : createdAt) : null,
        createdById: user.id,
        createdAt,
        updatedAt: row.updatedAt ? new Date(String(row.updatedAt)) : createdAt,
        tags: { create: tagIds.map((tagId) => ({ tagId })) },
        items: { create: itemData },
      },
    });
    imported++;
  }
  console.log(`${imported} fiches historiques traitées, ${legacyTags.length} tags synchronisés.`);
}

main()
  .finally(async () => { sqlite.close(); await prisma.$disconnect(); });
