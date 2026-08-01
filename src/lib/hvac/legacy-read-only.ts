import { TechnicalCatalogError } from "@/lib/hvac/errors";

export const LEGACY_CATALOG_READ_ONLY_MESSAGE =
  "Le catalogue PAC historique est en lecture seule. Utilisez la nouvelle bibliothèque technique pour toute administration.";

export function rejectLegacyCatalogMutation(): never {
  throw new TechnicalCatalogError(
    LEGACY_CATALOG_READ_ONLY_MESSAGE,
    "LEGACY_READ_ONLY",
  );
}
