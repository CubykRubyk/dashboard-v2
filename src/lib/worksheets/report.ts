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
  const installationLines = data.mainInstallations
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  installationLines.forEach((line) => lines.push(`- installation ${line}`));

  const lookup = new Map(
    categories.flatMap((category) =>
      category.materials.map((material) => [material.id, { category, material }] as const),
    ),
  );
  const companyLines: string[] = [];
  const internalLines: string[] = [];

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

    if (material.key === "bouteille_melange" && selection.supplier === "INTERNAL") {
      lines.push(`- installation ${label}`);
      continue;
    }

    const finalText = selection.installed ? text : `${text} (non installé)`;
    (selection.supplier === "COMPANY" ? companyLines : internalLines).push(finalText);
  }

  if (installationLines.length || lines.length > 1) lines.push("");
  internalLines.forEach((line) => lines.push(`- ${line}`));
  if (data.otherMaterials.trim()) lines.push(`- Alte materiale: ${data.otherMaterials.trim()}`);

  if (companyLines.length) {
    if (lines.at(-1) !== "") lines.push("");
    lines.push(`FOURNI${data.company.trim() ? ` ${data.company.trim()}` : ""}:`);
    companyLines.forEach((line) => lines.push(`- ${line}`));
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd();
}
