import assert from "node:assert/strict";
import test from "node:test";
import {
  cleanCatalogName,
  normalizeCatalogName,
  normalizeEquipmentReference,
} from "../../src/lib/hvac/normalization";

test("equipment references ignore casing and every whitespace character", () => {
  const expected = "epra16dw17";
  assert.equal(normalizeEquipmentReference("EPRA 16 DW17"), expected);
  assert.equal(normalizeEquipmentReference("epra16dw17"), expected);
  assert.equal(normalizeEquipmentReference("  EPRA\t16\nDW17  "), expected);
});

test("catalog names trim and collapse whitespace before normalization", () => {
  assert.equal(cleanCatalogName("  Atlantic   France "), "Atlantic France");
  assert.equal(normalizeCatalogName("  ATLANTIC   France "), "atlantic france");
});
