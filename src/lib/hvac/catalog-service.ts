import type {
  EquipmentInput,
  ManufacturerInput,
  ProductRangeInput,
} from "@/lib/hvac/validation";
import {
  normalizeCatalogName,
  normalizeEquipmentReference,
} from "@/lib/hvac/normalization";
import { TechnicalCatalogError } from "@/lib/hvac/errors";

export interface CatalogLookup {
  findManufacturer(id: string): Promise<{ id: string } | null>;
  findManufacturerDuplicate(
    normalizedName: string,
    excludeId?: string,
  ): Promise<{ id: string } | null>;
  findProductRange(id: string): Promise<{
    id: string;
    manufacturerId: string;
  } | null>;
  findProductRangeDuplicate(
    manufacturerId: string,
    normalizedName: string,
    excludeId?: string,
  ): Promise<{ id: string } | null>;
  findEquipmentDuplicate(
    manufacturerId: string,
    normalizedReference: string,
    excludeId?: string,
  ): Promise<{ id: string } | null>;
}

export async function validateManufacturerName(
  lookup: CatalogLookup,
  input: ManufacturerInput,
  excludeManufacturerId?: string,
) {
  const data = manufacturerData(input);
  const duplicate = await lookup.findManufacturerDuplicate(
    data.normalizedName,
    excludeManufacturerId,
  );
  if (duplicate) {
    throw new TechnicalCatalogError(
      "Un fabricant portant ce nom existe déjà.",
      "DUPLICATE",
    );
  }
  return data;
}

export async function validateProductRange(
  lookup: CatalogLookup,
  input: ProductRangeInput,
  excludeProductRangeId?: string,
) {
  const manufacturer = await lookup.findManufacturer(input.manufacturerId);
  if (!manufacturer) {
    throw new TechnicalCatalogError(
      "Le fabricant sélectionné n’existe plus.",
      "NOT_FOUND",
    );
  }
  const data = productRangeData(input);
  const duplicate = await lookup.findProductRangeDuplicate(
    input.manufacturerId,
    data.normalizedName,
    excludeProductRangeId,
  );
  if (duplicate) {
    throw new TechnicalCatalogError(
      "Cette gamme existe déjà pour ce fabricant.",
      "DUPLICATE",
    );
  }
  return data;
}

export async function validateEquipmentAssociations(
  lookup: CatalogLookup,
  input: Pick<EquipmentInput, "manufacturerId" | "productRangeId" | "manufacturerReference">,
  excludeEquipmentId?: string,
) {
  const manufacturer = await lookup.findManufacturer(input.manufacturerId);
  if (!manufacturer) {
    throw new TechnicalCatalogError(
      "Le fabricant sélectionné n’existe plus.",
      "NOT_FOUND",
    );
  }

  if (input.productRangeId) {
    const productRange = await lookup.findProductRange(input.productRangeId);
    if (!productRange) {
      throw new TechnicalCatalogError(
        "La gamme sélectionnée n’existe plus.",
        "NOT_FOUND",
      );
    }
    if (productRange.manufacturerId !== input.manufacturerId) {
      throw new TechnicalCatalogError(
        "La gamme sélectionnée appartient à un autre fabricant.",
        "RANGE_MANUFACTURER_MISMATCH",
      );
    }
  }

  const normalizedReference = normalizeEquipmentReference(
    input.manufacturerReference,
  );
  const duplicate = await lookup.findEquipmentDuplicate(
    input.manufacturerId,
    normalizedReference,
    excludeEquipmentId,
  );
  if (duplicate) {
    throw new TechnicalCatalogError(
      "Cette référence existe déjà pour ce fabricant.",
      "DUPLICATE",
    );
  }

  return { normalizedReference };
}

export function manufacturerData(input: ManufacturerInput) {
  return {
    name: input.name,
    normalizedName: normalizeCatalogName(input.name),
  };
}

export function productRangeData(input: ProductRangeInput) {
  return {
    manufacturerId: input.manufacturerId,
    name: input.name,
    normalizedName: normalizeCatalogName(input.name),
  };
}

export function equipmentData(
  input: EquipmentInput,
  normalizedReference: string,
  referenceNeedsReview: boolean,
) {
  return {
    ...input,
    normalizedReference,
    referenceNeedsReview,
  };
}

export function referenceNeedsReviewAfterEdit(
  current: {
    normalizedReference: string;
    referenceNeedsReview: boolean;
  },
  nextNormalizedReference: string,
) {
  return current.normalizedReference === nextNormalizedReference
    ? current.referenceNeedsReview
    : false;
}
