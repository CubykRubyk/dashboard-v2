import assert from "node:assert/strict";
import test from "node:test";
import {
  ElectricalSupply,
  EquipmentType,
  HeatPumpSplitLiaisonType,
  HeatPumpType,
} from "../../src/generated/prisma/enums";
import { canManageTechnicalCatalog } from "../../src/lib/auth/permissions";
import type { CombinationLookup } from "../../src/lib/hvac/combination-service";
import {
  combinationStatusData,
  validateCombination,
} from "../../src/lib/hvac/combination-service";
import type { CombinationInput } from "../../src/lib/hvac/combination-validation";
import { TechnicalCatalogError } from "../../src/lib/hvac/errors";

const equipment = {
  indoorA: {
    id: "indoor-a",
    manufacturerId: "manufacturer-a",
    manufacturerReference: "UI 100",
    name: "Indoor A",
    type: EquipmentType.INDOOR_UNIT,
    active: true,
  },
  outdoorA: {
    id: "outdoor-a",
    manufacturerId: "manufacturer-a",
    manufacturerReference: "UE 100",
    name: "Outdoor A",
    type: EquipmentType.OUTDOOR_UNIT,
    active: true,
  },
  indoorB: {
    id: "indoor-b",
    manufacturerId: "manufacturer-b",
    manufacturerReference: "UI 200",
    name: "Indoor B",
    type: EquipmentType.INDOOR_UNIT,
    active: true,
  },
  outdoorB: {
    id: "outdoor-b",
    manufacturerId: "manufacturer-b",
    manufacturerReference: "UE 200",
    name: "Outdoor B",
    type: EquipmentType.OUTDOOR_UNIT,
    active: true,
  },
  monoblocA: {
    id: "monobloc-a",
    manufacturerId: "manufacturer-a",
    manufacturerReference: "MONO 100",
    name: "Monobloc A",
    type: EquipmentType.MONOBLOC,
    active: true,
  },
  inactiveIndoorA: {
    id: "inactive-indoor-a",
    manufacturerId: "manufacturer-a",
    manufacturerReference: "UI OLD",
    name: "Inactive indoor A",
    type: EquipmentType.INDOOR_UNIT,
    active: false,
  },
};

const allEquipment = new Map(
  Object.values(equipment).map((item) => [item.id, item]),
);

function lookup(
  overrides: Partial<CombinationLookup> = {},
): CombinationLookup {
  return {
    async findManufacturer(id) {
      return id === "manufacturer-a" || id === "manufacturer-b"
        ? { id }
        : null;
    },
    async findProductRange(id) {
      return id === "range-a"
        ? { id, manufacturerId: "manufacturer-a" }
        : id === "range-b"
          ? { id, manufacturerId: "manufacturer-b" }
          : null;
    },
    async findEquipment(id) {
      return allEquipment.get(id) ?? null;
    },
    async findCombinationPairDuplicate() {
      return null;
    },
    async findCombinationNameDuplicate() {
      return null;
    },
    ...overrides,
  };
}

function validInput(
  overrides: Partial<CombinationInput> = {},
): CombinationInput {
  return {
    manufacturerId: "manufacturer-a",
    productRangeId: "range-a",
    outdoorEquipmentId: "outdoor-a",
    indoorEquipmentId: "indoor-a",
    name: "",
    applicationType: HeatPumpType.AIR_WATER,
    splitLiaisonType: HeatPumpSplitLiaisonType.FRIGORIFIC,
    electricalSupply: ElectricalSupply.SINGLE_PHASE,
    nominalPowerKw: 10,
    commissioningNotes: "",
    installationNotes: "",
    internalNotes: "",
    active: true,
    ...overrides,
  };
}

async function rejectsWithCode(
  promise: Promise<unknown>,
  code: TechnicalCatalogError["code"],
) {
  await assert.rejects(
    promise,
    (error) => error instanceof TechnicalCatalogError && error.code === code,
  );
}

test("a valid indoor and outdoor pair creates predictable combination data", async () => {
  const result = await validateCombination(lookup(), validInput());
  assert.equal(result.indoorEquipment.id, "indoor-a");
  assert.equal(result.outdoorEquipment.id, "outdoor-a");
  assert.equal(result.combination.name, "UE 100 + UI 100");
  assert.equal(result.combination.normalizedName, "ue 100 + ui 100");
});

test("an indoor unit from another manufacturer is rejected", async () => {
  await rejectsWithCode(
    validateCombination(
      lookup(),
      validInput({ indoorEquipmentId: "indoor-b" }),
    ),
    "INVALID_COMPONENT",
  );
});

test("an outdoor unit from another manufacturer is rejected", async () => {
  await rejectsWithCode(
    validateCombination(
      lookup(),
      validInput({ outdoorEquipmentId: "outdoor-b" }),
    ),
    "INVALID_COMPONENT",
  );
});

test("an equipment with the wrong role type is rejected", async () => {
  await rejectsWithCode(
    validateCombination(
      lookup(),
      validInput({ indoorEquipmentId: "outdoor-a" }),
    ),
    "INVALID_COMPONENT",
  );
});

test("a monobloc cannot be used in a split combination", async () => {
  await rejectsWithCode(
    validateCombination(
      lookup(),
      validInput({ outdoorEquipmentId: "monobloc-a" }),
    ),
    "INVALID_COMPONENT",
  );
});

test("a duplicate indoor and outdoor pair is rejected", async () => {
  await rejectsWithCode(
    validateCombination(
      lookup({
        async findCombinationPairDuplicate() {
          return { id: "existing-combination" };
        },
      }),
      validInput(),
    ),
    "DUPLICATE",
  );
});

test("editing excludes the current combination from pair duplicate lookup", async () => {
  let excludedId: string | undefined;
  const result = await validateCombination(
    lookup({
      async findCombinationPairDuplicate(
        _manufacturerId,
        _indoorId,
        _outdoorId,
        excludeCombinationId,
      ) {
        excludedId = excludeCombinationId;
        return null;
      },
    }),
    validInput({ name: "Existing combination" }),
    { combinationId: "combination-a" },
  );
  assert.equal(excludedId, "combination-a");
  assert.equal(result.combination.name, "Existing combination");
});

test("inactive equipment is rejected when creating a combination", async () => {
  await rejectsWithCode(
    validateCombination(
      lookup(),
      validInput({ indoorEquipmentId: "inactive-indoor-a" }),
    ),
    "INACTIVE_COMPONENT",
  );
});

test("an already selected inactive component may be retained during edit", async () => {
  const result = await validateCombination(
    lookup(),
    validInput({ indoorEquipmentId: "inactive-indoor-a" }),
    {
      combinationId: "combination-a",
      currentIndoorEquipmentId: "inactive-indoor-a",
      currentOutdoorEquipmentId: "outdoor-a",
    },
  );
  assert.equal(result.indoorEquipment.id, "inactive-indoor-a");
});

test("only ADMIN can execute combination mutations", () => {
  assert.equal(canManageTechnicalCatalog("ADMIN"), true);
  assert.equal(canManageTechnicalCatalog("OPERATOR"), false);
  assert.equal(canManageTechnicalCatalog("VIEWER"), false);
  assert.equal(canManageTechnicalCatalog(undefined), false);
});

test("deactivation changes only status and cannot remove component data", () => {
  assert.deepEqual(combinationStatusData(false), { active: false });
  assert.equal("components" in combinationStatusData(false), false);
});

test("a range from another manufacturer is rejected", async () => {
  await rejectsWithCode(
    validateCombination(
      lookup(),
      validInput({ productRangeId: "range-b" }),
    ),
    "RANGE_MANUFACTURER_MISMATCH",
  );
});

test("the same equipment cannot occupy both component roles", async () => {
  await rejectsWithCode(
    validateCombination(
      lookup(),
      validInput({
        indoorEquipmentId: "indoor-a",
        outdoorEquipmentId: "indoor-a",
      }),
    ),
    "INVALID_COMPONENT",
  );
});
