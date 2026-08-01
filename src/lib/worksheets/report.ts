import type { MaterialUnit } from "@/generated/prisma/enums";
import type {
  CatalogCategory,
  WorkSheetFormData,
} from "./types";

function formatDate(date: string) {
  if (!date) return "—";
  const [year, month, day] = date.split("-");
  return year && month && day ? `${day}/${month}/${year}` : date;
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : String(value).replace(".", ",");
}

function provenance(sourceSupplier: string, deliveryNote: string) {
  const note = deliveryNote.trim();
  const formattedNote = note
    ? /^bl/i.test(note)
      ? note
      : `BL ${note}`
    : "";
  const value = [sourceSupplier.trim(), formattedNote].filter(Boolean).join(" ");
  return value ? ` (${value})` : "";
}

function normalLine(
  key: string,
  label: string,
  unit: MaterialUnit,
  quantity: number,
  detailValue: number,
) {
  if (key === "desembouage") {
    return detailValue > 0 ? `desembouage (${formatNumber(detailValue)} radiateurs)` : "desembouage";
  }
  if (key === "dalle") {
    return `dalle beton (${detailValue > 0 ? formatNumber(detailValue) : "—"} sacs)`;
  }
  if (unit === "METER") return `${formatNumber(quantity)}m ${label}`;
  return `${formatNumber(quantity || 1)} x ${label}`;
}

export function generateWorkSheetReport(
  data: WorkSheetFormData,
  categories: CatalogCategory[],
) {
  const lines: string[] = [
    `&chantier fini le ${formatDate(data.workDate)}${data.installer ? ` - ${data.installer}` : ""}`,
  ];
  const legacyInstallationLines = data.installations.length
    ? []
    : data.mainInstallations
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
  const companyLines: string[] = [];
  const internalLines: string[] = [];
  const internalMaterialGroups = new Map<string, string[]>();
  const addInternalMaterial = (categoryKey: string, text: string) => {
    internalMaterialGroups.set(categoryKey, [
      ...(internalMaterialGroups.get(categoryKey) || []),
      text,
    ]);
  };

  legacyInstallationLines.forEach((line) => lines.push(`- installation ${line}`));
  data.installations.filter((installation) => installation.designation.trim()).forEach((installation) => {
    const quantity = installation.quantity > 1
      ? `${formatNumber(installation.quantity)} x `
      : "";
    const suppliedItem =
      `${quantity}${installation.designation}` +
      provenance(installation.sourceSupplier, installation.deliveryNote) +
      (installation.installed ? "" : " (non installé)");
    if (installation.installed) {
      lines.push(`- installation ${quantity}${installation.designation}${provenance(installation.sourceSupplier, installation.deliveryNote)}`);
    }
    if (installation.supplier === "COMPANY") companyLines.push(suppliedItem);
    else if (!installation.installed) internalLines.push(suppliedItem);
  });

  const lookup = new Map(
    categories.flatMap((category) =>
      category.materials.map((material) => [material.id, { category, material }] as const),
    ),
  );
  for (const selection of data.selections.filter((item) => item.selected)) {
    const found = lookup.get(selection.materialId);
    if (!found) continue;
    const { material } = found;
    const variant = material.variants.find((item) => item.id === selection.variantId);
    const label = variant?.reportLabel || material.reportLabel;
    const text = normalLine(
      material.key,
      label,
      material.unit,
      selection.quantity || 1,
      selection.detailValue || 0,
    );

    if (material.key === "desembouage" || material.key === "dalle") {
      lines.push(`- ${text}`);
      continue;
    }

    if (material.key === "bouteille_melange") {
      const installed = material.allowNotInstalled ? selection.installed : true;
      const supplier = material.allowSupplier ? selection.supplier : "INTERNAL";
      if (installed) lines.push(`- installation ${label}`);
      if (supplier === "COMPANY") {
        companyLines.push(installed ? text : `${text} (non installé)`);
      } else {
        addInternalMaterial(
          found.category.key,
          installed ? text : `${text} (non installé)`,
        );
      }
      continue;
    }

    const installed = material.allowNotInstalled ? selection.installed : true;
    const supplier = material.allowSupplier ? selection.supplier : "INTERNAL";
    const finalText = installed ? text : `${text} (non installé)`;
    if (supplier === "COMPANY") companyLines.push(finalText);
    else addInternalMaterial(found.category.key, finalText);
  }

  if (legacyInstallationLines.length || data.installations.length || lines.length > 1) lines.push("");
  let hasInternalContent = false;
  internalLines.forEach((line) => lines.push(`- ${line}`));
  if (internalLines.length) hasInternalContent = true;
  for (const group of internalMaterialGroups.values()) {
    if (hasInternalContent && lines.at(-1) !== "") lines.push("");
    group.forEach((line) => lines.push(`- ${line}`));
    hasInternalContent = true;
  }
  if (data.otherMaterials.trim()) lines.push(`- Alte materiale: ${data.otherMaterials.trim()}`);

  if (companyLines.length) {
    if (lines.at(-1) !== "") lines.push("");
    lines.push(`FOURNI${data.company.trim() ? ` ${data.company.trim()}` : ""}:`);
    companyLines.forEach((line) => lines.push(`- ${line}`));
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd();
}
