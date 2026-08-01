import assert from "node:assert/strict";
import test from "node:test";
import type { CatalogLookup } from "../../src/lib/hvac/catalog-service";
import {
  referenceNeedsReviewAfterEdit,
  validateEquipmentAssociations,
} from "../../src/lib/hvac/catalog-service";
import { TechnicalCatalogError } from "../../src/lib/hvac/errors";

function lookup(
  overrides: Partial<CatalogLookup> = {},
): CatalogLookup {
  return {
    async findManufacturer(id) {
      return id === "manufacturer-a" ? { id } : null;
    },
    async findManufacturerDuplicate() {
      return null;
    },
    async findProductRange(id) {
      return id === "range-a"
        ? { id, manufacturerId: "manufacturer-a" }
        : id === "range-b"
          ? { id, manufacturerId: "manufacturer-b" }
          : null;
    },
    async findProductRangeDuplicate() {
      return null;
    },
    async findEquipmentDuplicate() {
      return null;
    },
    ...overrides,
  };
}

test("duplicate equipment references are rejected per manufacturer", async () => {
  const repository = lookup({
    async findEquipmentDuplicate(
      manufacturerId,
      normalizedReference,
    ) {
      assert.equal(manufacturerId, "manufacturer-a");
      assert.equal(normalizedReference, "epra16dw17");
      return { id: "existing-equipment" };
    },
  });

  await assert.rejects(
    validateEquipmentAssociations(repository, {
      manufacturerId: "manufacturer-a",
      productRangeId: "range-a",
      manufacturerReference: "EPRA 16 DW17",
    }),
    (error) => (
      error instanceof TechnicalCatalogError
      && error.code === "DUPLICATE"
    ),
  );
});

test("a range belonging to another manufacturer is rejected", async () => {
  await assert.rejects(
    validateEquipmentAssociations(lookup(), {
      manufacturerId: "manufacturer-a",
      productRangeId: "range-b",
      manufacturerReference: "UI-100",
    }),
    (error) => (
      error instanceof TechnicalCatalogError
      && error.code === "RANGE_MANUFACTURER_MISMATCH"
    ),
  );
});

test("editing a legacy reference clears review only when reference changes", () => {
  const legacy = {
    normalizedReference: "legacy-model-indoor",
    referenceNeedsReview: true,
  };
  assert.equal(
    referenceNeedsReviewAfterEdit(legacy, "legacy-model-indoor"),
    true,
  );
  assert.equal(
    referenceNeedsReviewAfterEdit(legacy, "real-reference-100"),
    false,
  );
});
