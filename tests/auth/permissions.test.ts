import assert from "node:assert/strict";
import test from "node:test";
import { canManageTechnicalCatalog } from "../../src/lib/auth/permissions";

test("only administrators can mutate the technical catalog", () => {
  assert.equal(canManageTechnicalCatalog("ADMIN"), true);
  assert.equal(canManageTechnicalCatalog("OPERATOR"), false);
  assert.equal(canManageTechnicalCatalog("VIEWER"), false);
  assert.equal(canManageTechnicalCatalog(null), false);
});

test("forced delete mutations are denied to OPERATOR, VIEWER and unauthenticated users", () => {
  for (const role of ["OPERATOR", "VIEWER", null] as const) {
    assert.equal(canManageTechnicalCatalog(role), false);
  }
});
