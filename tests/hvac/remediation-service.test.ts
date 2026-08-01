import assert from "node:assert/strict";
import test from "node:test";
import { EquipmentType } from "../../src/generated/prisma/enums";
import {
  assertValidSplitComponents,
} from "../../src/lib/hvac/combination-service";
import {
  activeAssociatedDocuments,
  assertDeletionConfirmation,
  assertEquipmentDeletionAllowed,
  EquipmentDeletionBlockedError,
} from "../../src/lib/hvac/deletion-service";
import { TechnicalCatalogError } from "../../src/lib/hvac/errors";
import {
  LEGACY_CATALOG_READ_ONLY_MESSAGE,
  legacyMutationAuditMetadata,
  legacyMutationRejectedError,
} from "../../src/lib/hvac/legacy-read-only";

const indoor = {
  equipmentId: "indoor",
  role: EquipmentType.INDOOR_UNIT,
  equipmentType: EquipmentType.INDOOR_UNIT,
};
const outdoor = {
  equipmentId: "outdoor",
  role: EquipmentType.OUTDOOR_UNIT,
  equipmentType: EquipmentType.OUTDOOR_UNIT,
};

function rejectsInvalidComponents(
  components: Parameters<typeof assertValidSplitComponents>[0],
) {
  assert.throws(
    () => assertValidSplitComponents(components),
    (error) => (
      error instanceof TechnicalCatalogError
      && error.code === "INVALID_COMPONENT"
    ),
  );
}

test("legacy HeatPump and PacDocument mutations are always refused", () => {
  assert.throws(
    () => {
      throw legacyMutationRejectedError();
    },
    (error) => (
      error instanceof TechnicalCatalogError
      && error.code === "LEGACY_READ_ONLY"
      && error.message === LEGACY_CATALOG_READ_ONLY_MESSAGE
    ),
  );
});

test("legacy rejection audit metadata is limited and identifies the attempted operation", () => {
  const metadata = legacyMutationAuditMetadata({
    operation: "DELETE",
    entityType: "Refrigerant",
    entityId: "refrigerant-a",
  }, {
    sessionUserId: "admin-a",
    currentRole: "ADMIN",
    active: true,
  });
  assert.deepEqual(metadata, {
    operation: "DELETE",
    entityType: "Refrigerant",
    entityId: "refrigerant-a",
    reason: "LEGACY_CATALOG_READ_ONLY",
    actor: {
      sessionUserId: "admin-a",
      currentRole: "ADMIN",
      active: true,
    },
  });
  assert.equal("payload" in metadata, false);
  assert.equal("token" in metadata, false);
  assert.equal("path" in metadata, false);
});

test("a split component set contains exactly one UI and one UE", () => {
  assert.doesNotThrow(() => assertValidSplitComponents([indoor, outdoor]));
});

test("two indoor units are refused", () => {
  rejectsInvalidComponents([
    indoor,
    { ...indoor, equipmentId: "indoor-2" },
    outdoor,
  ]);
});

test("two outdoor units are refused", () => {
  rejectsInvalidComponents([
    indoor,
    outdoor,
    { ...outdoor, equipmentId: "outdoor-2" },
  ]);
});

test("duplicate components are refused", () => {
  rejectsInvalidComponents([
    indoor,
    {
      equipmentId: "indoor",
      role: EquipmentType.OUTDOOR_UNIT,
      equipmentType: EquipmentType.OUTDOOR_UNIT,
    },
  ]);
});

test("wrong equipment types and monobloc components are refused", () => {
  rejectsInvalidComponents([
    indoor,
    {
      ...outdoor,
      equipmentType: EquipmentType.MONOBLOC,
    },
  ]);
});

test("deletion confirmation must match the current entity", () => {
  assert.doesNotThrow(() => assertDeletionConfirmation("UE-100", "UE-100"));
  assert.throws(
    () => assertDeletionConfirmation("UE-10", "UE-100"),
    (error) => (
      error instanceof TechnicalCatalogError
      && error.code === "CONFIRMATION_REQUIRED"
    ),
  );
});

test("equipment deletion reports the exact blocking combinations", () => {
  const blockers = [{
    id: "combination-a",
    name: "UE-100 + UI-100",
    indoorReference: "UI-100",
    outdoorReference: "UE-100",
  }];
  assert.throws(
    () => assertEquipmentDeletionAllowed(blockers),
    (error) => (
      error instanceof EquipmentDeletionBlockedError
      && error.blockers === blockers
      && error.message.includes("UE-100 + UI-100")
    ),
  );
});

test("inactive associated documents are not presented as active", () => {
  const documents = activeAssociatedDocuments([
    { id: "active", active: true },
    { id: "inactive", active: false },
  ]);
  assert.deepEqual(documents.map((document) => document.id), ["active"]);
});
