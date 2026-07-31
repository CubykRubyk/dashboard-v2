import "dotenv/config";
import { hash } from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  MaterialInputType,
  MaterialUnit,
  PrismaClient,
  UserRole,
} from "../src/generated/prisma/client";

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
const name = process.env.ADMIN_NAME?.trim() || "Administrator";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL est manquante.");
if (!email) throw new Error("ADMIN_EMAIL est manquante.");
if (!password || password.length < 12) {
  throw new Error("ADMIN_PASSWORD doit contenir au moins 12 caractères.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const passwordHash = await hash(password!, 12);
  await prisma.user.upsert({
    where: { email: email! },
    update: { name, passwordHash, role: UserRole.ADMIN, active: true },
    create: { email: email!, name, passwordHash, role: UserRole.ADMIN },
  });
  console.log(`Le compte administrateur ${email} est prêt.`);

  const categories = [
    ["pac", "PAC"],
    ["ballon", "Ballon"],
    ["accessoires", "Autres accessoires"],
    ["ssc", "SSC"],
    ["cables", "Câbles"],
    ["liaisons", "Liaisons frigorifiques"],
    ["isolation", "Isolation"],
    ["multicouche", "Multicouche isolé"],
    ["raccords", "Raccords multicouche"],
    ["vmc", "VMC / VMR"],
  ] as const;

  const categoryIds = new Map<string, string>();
  for (const [position, [key, categoryName]] of categories.entries()) {
    const category = await prisma.materialCategory.upsert({
      where: { key },
      update: { name: categoryName, position },
      create: { key, name: categoryName, position },
    });
    categoryIds.set(key, category.id);
  }

  type SeedMaterial = {
    key: string;
    name: string;
    reportLabel: string;
    category: string;
    inputType?: MaterialInputType;
    unit?: MaterialUnit;
    detailLabel?: string;
    variants?: [string, string][];
  };

  const materials: SeedMaterial[] = [
    { key: "bouteille_melange", name: "Bouteille de mélange", reportLabel: "bouteille de mélange", category: "pac", inputType: MaterialInputType.SELECT, variants: [["30 L", "bouteille de mélange 30L"], ["50 L", "bouteille de mélange 50L"], ["100 L", "bouteille de mélange 100L"]] },
    { key: "thermostat", name: "Thermostat", reportLabel: "thermostat", category: "pac", inputType: MaterialInputType.SELECT, variants: [["Sans nom", "thermostat"], ["Netatmo", "thermostat Netatmo"], ["Salus", "thermostat Salus"], ["Navilink", "thermostat Navilink"], ["Daikin", "thermostat Daikin"], ["Bosch", "thermostat BOSCH"]] },
    { key: "pot", name: "Pot à boue", reportLabel: "pot a boue", category: "pac", inputType: MaterialInputType.QUANTITY },
    { key: "disconnecteur", name: "Disconnecteur", reportLabel: "disconnecteur", category: "pac", inputType: MaterialInputType.QUANTITY },
    { key: "circulateur", name: "Circulateur", reportLabel: "circulateur", category: "pac", inputType: MaterialInputType.SELECT, variants: [["Sans nom", "circulateur"], ["Altech", "circulateur Altech"], ["Antares/Somatherm", "circulateur Antares/Somatherm"], ["IBO", "circulateur IBO + raccord"]] },
    { key: "soupape", name: "Soupape différentielle", reportLabel: "soupape différentielle", category: "pac", inputType: MaterialInputType.QUANTITY },
    { key: "vase18", name: "Vase d’expansion chauffage 18 L", reportLabel: "vase d'expansion 18L", category: "pac" },
    { key: "support18", name: "Support vase chauffage", reportLabel: "support equipe vase d'expansion chauffage", category: "pac" },
    { key: "vanne", name: "Vanne d’équilibrage", reportLabel: "vanne d'équilibrage", category: "pac", inputType: MaterialInputType.QUANTITY },
    { key: "coupure", name: "Coupure d’urgence", reportLabel: "coupure urgence", category: "pac", inputType: MaterialInputType.QUANTITY },
    { key: "antigel", name: "Soupape antigel", reportLabel: "soupape antigel", category: "pac", inputType: MaterialInputType.QUANTITY },
    { key: "desembouage", name: "Désembouage", reportLabel: "desembouage", category: "pac", inputType: MaterialInputType.DETAIL, unit: MaterialUnit.RADIATOR, detailLabel: "Nombre de radiateurs" },
    { key: "dalle", name: "Dalle béton", reportLabel: "dalle beton", category: "pac", inputType: MaterialInputType.DETAIL, unit: MaterialUnit.BAG, detailLabel: "Nombre de sacs" },
    { key: "vase12", name: "Vase d’expansion sanitaire 12 L", reportLabel: "vase d'expansion 12L", category: "ballon" },
    { key: "support12", name: "Support vase sanitaire", reportLabel: "support vase d'expansion sanitaire", category: "ballon" },
    { key: "trepied_ballon", name: "Trépied ballon", reportLabel: "trépied ballon", category: "ballon" },
    { key: "mitigeur", name: "Mitigeur thermostatique", reportLabel: "mitigeur thermostatique", category: "ballon", inputType: MaterialInputType.QUANTITY },
    { key: "reducteur", name: "Réducteur de pression", reportLabel: "réducteur pression", category: "ballon", inputType: MaterialInputType.QUANTITY },
    { key: "pompe", name: "Pompe de relevage BTD", reportLabel: "pompe relevage BTD", category: "ballon", inputType: MaterialInputType.QUANTITY },
    { key: "support_mural", name: "Support mural", reportLabel: "support mural", category: "accessoires", inputType: MaterialInputType.QUANTITY },
    { key: "support_sol", name: "Support sol", reportLabel: "support sol", category: "accessoires", inputType: MaterialInputType.QUANTITY },
    { key: "filtre", name: "Filtre à tamis 26×34", reportLabel: "filtre à tamis 26x34", category: "accessoires", inputType: MaterialInputType.QUANTITY },
    { key: "repartiteur_tri", name: "Répartiteur 4P triphasé", reportLabel: "répartiteur 4P tri", category: "accessoires", inputType: MaterialInputType.QUANTITY },
    { key: "repartiteur_mono", name: "Répartiteur 2P monophasé", reportLabel: "répartiteur 2P mono", category: "accessoires", inputType: MaterialInputType.QUANTITY },
    { key: "clapet2634", name: "Clapet anti-retour 26×34", reportLabel: "clapet anti-retour 26x34", category: "accessoires", inputType: MaterialInputType.QUANTITY },
    { key: "clapet2027", name: "Clapet anti-retour 20×27", reportLabel: "clapet anti-retour 20x27", category: "accessoires", inputType: MaterialInputType.QUANTITY },
    { key: "mufe", name: "Mufe rapide", reportLabel: "mufe rapide (raccord à compression)", category: "accessoires", inputType: MaterialInputType.QUANTITY },
    { key: "kit_ssc", name: "KIT SSC FHE", reportLabel: "KIT SSC FHE", category: "ssc" },
    { key: "bitube_inox", name: "Bitube inox", reportLabel: "bitube inox", category: "ssc", inputType: MaterialInputType.QUANTITY, unit: MaterialUnit.METER },
    { key: "passe_cables", name: "Passe-câbles solaire", reportLabel: "passe câbles solaire", category: "ssc" },
    { key: "vase35", name: "Vase d’expansion 35 L", reportLabel: "vase d'expansion 35L", category: "ssc" },
    { key: "support35", name: "Support vase 35 L", reportLabel: "support equipe vase d'expansion 35L", category: "ssc" },
    { key: "vmc_install", name: "VMC", reportLabel: "VMC", category: "ssc" },
    { key: "vmr_install", name: "VMR", reportLabel: "VMR", category: "ssc" },
  ];

  const measured = [
    ["cables", "c3g16", "Câble 3G × 16", "cable 3Gx16", MaterialUnit.METER],
    ["cables", "c3g10", "Câble 3G × 10", "cable 3Gx10", MaterialUnit.METER],
    ["cables", "c3g6", "Câble 3G × 6", "cable 3Gx6", MaterialUnit.METER],
    ["cables", "c3g25", "Câble 3G × 2,5", "cable 3Gx2.5", MaterialUnit.METER],
    ["cables", "c4g15", "Câble 4G × 1,5", "cable 4Gx1.5", MaterialUnit.METER],
    ["cables", "c5g16", "Câble 5G × 16", "cable 5Gx16", MaterialUnit.METER],
    ["cables", "c5g10", "Câble 5G × 10", "cable 5Gx10", MaterialUnit.METER],
    ["cables", "c5g6", "Câble 5G × 6", "cable 5Gx6", MaterialUnit.METER],
    ["cables", "c5g25", "Câble 5G × 2,5", "cable 5Gx2.5", MaterialUnit.METER],
    ["cables", "c2g075", "Câble 2G × 0,75", "cable 2Gx0.75", MaterialUnit.METER],
    ["cables", "c3g075", "Câble 3G × 0,75", "cable 3Gx0.75", MaterialUnit.METER],
    ["cables", "c7g15", "Câble 7G × 1,5", "cable 7Gx1.5", MaterialUnit.METER],
    ["liaisons", "liaison_pac", "Liaison PAC 3/8–5/8", "liaison frigo pac 3/8 5/8", MaterialUnit.METER],
    ["liaisons", "liaison_pac_14_12", "Liaison PAC 1/4–1/2", "liaison frigo PAC 1/4 1/2", MaterialUnit.METER],
    ["liaisons", "liaison_ballon", "Liaison ballon split 1/4–3/8", "liaison frigo ballon split 1/4 3/8", MaterialUnit.METER],
    ["isolation", "iso28", "Isolation 28", "isolation 28", MaterialUnit.METER],
    ["isolation", "iso18", "Isolation 18", "isolation 18", MaterialUnit.METER],
    ["isolation", "iso_coude", "Isolation coude", "isolation coude", MaterialUnit.METER],
    ["multicouche", "multi16", "Multicouche isolé 16", "multicouche isole 16", MaterialUnit.METER],
    ["multicouche", "multi32", "Multicouche isolé 32", "multicouche isole 32", MaterialUnit.METER],
    ["multicouche", "barre16", "Barre multicouche 16", "barre multicouche 16", MaterialUnit.METER],
    ["multicouche", "barre32", "Barre multicouche 32", "barre multicouche 32", MaterialUnit.METER],
    ["raccords", "r_coude32", "Coude 32", "coude 32", MaterialUnit.PIECE],
    ["raccords", "r_droit32", "Droit 32", "droit 32", MaterialUnit.PIECE],
    ["raccords", "r_t323232", "T 32-32-32", "T32-32-32", MaterialUnit.PIECE],
    ["raccords", "r_t321632", "T 32-16-32", "T32-16-32", MaterialUnit.PIECE],
    ["raccords", "r_coude16", "Coude 16", "coude 16", MaterialUnit.PIECE],
    ["raccords", "r_droit16", "Droit 16", "droit 16", MaterialUnit.PIECE],
    ["raccords", "r_raccoude16", "Raccord coude 16", "racc coude 16", MaterialUnit.PIECE],
    ["raccords", "r_t161616", "T 16-16-16", "T16-16-16", MaterialUnit.PIECE],
    ["vmc", "gaine_d80", "Gaine D80", "gaine D80", MaterialUnit.PIECE],
    ["vmc", "gaine_d125", "Gaine D125", "gaine D125", MaterialUnit.PIECE],
    ["vmc", "gaine_d160", "Gaine D160", "gaine D160", MaterialUnit.PIECE],
    ["vmc", "v110", "110HY", "110HY", MaterialUnit.PIECE],
    ["vmc", "v120", "120L", "120L", MaterialUnit.PIECE],
    ["vmc", "chapeau", "Chapeau toiture", "chapeau toiture", MaterialUnit.PIECE],
  ] as const;

  for (const [category, key, materialName, reportLabel, unit] of measured) {
    materials.push({ key, name: materialName, reportLabel, category, inputType: MaterialInputType.QUANTITY, unit });
  }

  const positions = new Map<string, number>();
  for (const materialData of materials) {
    const categoryId = categoryIds.get(materialData.category);
    if (!categoryId) continue;
    const position = positions.get(materialData.category) || 0;
    positions.set(materialData.category, position + 1);
    const material = await prisma.material.upsert({
      where: { key: materialData.key },
      update: {
        name: materialData.name,
        reportLabel: materialData.reportLabel,
        inputType: materialData.inputType || MaterialInputType.CHECKBOX,
        unit: materialData.unit || MaterialUnit.PIECE,
        detailLabel: materialData.detailLabel,
        categoryId,
        position,
      },
      create: {
        key: materialData.key,
        name: materialData.name,
        reportLabel: materialData.reportLabel,
        inputType: materialData.inputType || MaterialInputType.CHECKBOX,
        unit: materialData.unit || MaterialUnit.PIECE,
        detailLabel: materialData.detailLabel,
        categoryId,
        position,
      },
    });

    for (const [variantPosition, variant] of (materialData.variants || []).entries()) {
      await prisma.materialVariant.upsert({
        where: { materialId_name: { materialId: material.id, name: variant[0] } },
        update: { reportLabel: variant[1], position: variantPosition },
        create: {
          materialId: material.id,
          name: variant[0],
          reportLabel: variant[1],
          position: variantPosition,
        },
      });
    }
  }

  console.log(`${categories.length} catégories et ${materials.length} articles sont prêts.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
  await prisma.$disconnect();
  });
