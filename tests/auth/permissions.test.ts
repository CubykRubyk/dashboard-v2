import assert from "node:assert/strict";
import test from "node:test";
import { canManageTechnicalCatalog } from "../../src/lib/auth/permissions";

test("only administrators can mutate the technical catalog", () => {
  assert.equal(canManageTechnicalCatalog("ADMIN"), true);
  assert.equal(canManageTechnicalCatalog("OPERATOR"), false);
  assert.equal(canManageTechnicalCatalog("VIEWER"), false);
  assert.equal(canManageTechnicalCatalog(null), false);
});
