export function cleanCatalogName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeCatalogName(value: string) {
  return cleanCatalogName(value).toLowerCase();
}

export function cleanEquipmentReference(value: string) {
  return value.trim();
}

export function normalizeEquipmentReference(value: string) {
  return cleanEquipmentReference(value).replace(/\s+/g, "").toLowerCase();
}
