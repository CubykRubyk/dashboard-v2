import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

test("legacy PAC page exposes no PacBrand or Refrigerant mutation controls", async () => {
  const page = await readFile(
    path.resolve("src/app/(dashboard)/pac/page.tsx"),
    "utf8",
  );
  for (const action of [
    "createPacBrand",
    "updatePacBrand",
    "togglePacBrand",
    "deletePacBrand",
    "createRefrigerant",
    "updateRefrigerant",
    "toggleRefrigerant",
    "deleteRefrigerant",
  ]) {
    assert.equal(page.includes(action), false, `${action} must not be rendered`);
  }
});

test("every legacy PAC mutation action delegates to the rejection guard", async () => {
  const actions = await readFile(
    path.resolve("src/app/(dashboard)/pac/actions.ts"),
    "utf8",
  );
  assert.equal(
    /prisma\.(?:heatPump|pacDocument|pacBrand|refrigerant)\.(?:create|update|delete|upsert)\s*\(/.test(
      actions,
    ),
    false,
  );
  assert.ok(
    (actions.match(/rejectLegacyCatalogMutation\(/g) ?? []).length >= 13,
  );
});
