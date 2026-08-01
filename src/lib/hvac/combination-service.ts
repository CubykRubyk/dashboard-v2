import type {
  EquipmentType,
} from "@/generated/prisma/enums";
import type { CombinationInput } from "@/lib/hvac/combination-validation";
import { TechnicalCatalogError } from "@/lib/hvac/errors";
import {
  cleanCatalogName,
  normalizeCatalogName,
} from "@/lib/hvac/normalization";

export interface CombinationEquipment {
  id: string;
  manufacturerId: string;
  manufacturerReference: string;
  name: string;
  type: EquipmentType;
  active: boolean;
}

export interface CombinationLookup {
  findManufacturer(id: string): Promise<{ id: string } | null>;
  findProductRange(id: string): Promise<{
    id: string;
    manufacturerId: string;
  } | null>;
  findEquipment(id: string): Promise<CombinationEquipment | null>;
  findCombinationPairDuplicate(
    manufacturerId: string,
    indoorEquipmentId: string,
    outdoorEquipmentId: string,
    excludeCombinationId?: string,
  ): Promise<{ id: string } | null>;
  findCombinationNameDuplicate(
    manufacturerId: string,
    normalizedName: string,
    excludeCombinationId?: string,
  ): Promise<{ id: string } | null>;
}

export interface CombinationValidationOptions {
  combinationId?: string;
  currentIndoorEquipmentId?: string;
  currentOutdoorEquipmentId?: string;
}

export interface SplitCombinationComponent {
  equipmentId: string;
  role: EquipmentType;
  equipmentType: EquipmentType;
}

export function assertValidSplitComponents(
  components: SplitCombinationComponent[],
) {
  const indoor = components.filter(
    (component) => component.role === "INDOOR_UNIT",
  );
  const outdoor = components.filter(
    (component) => component.role === "OUTDOOR_UNIT",
  );
  const duplicateIds = new Set(
    components
      .filter((component, index) => (
        components.findIndex(
          (candidate) => candidate.equipmentId === component.equipmentId,
        ) !== index
      ))
      .map((component) => component.equipmentId),
  );
  const invalidRole = components.some((component) => (
    component.role !== "INDOOR_UNIT"
    && component.role !== "OUTDOOR_UNIT"
  ));
  const invalidType = components.some(
    (component) => component.role !== component.equipmentType,
  );

  if (
    indoor.length !== 1
    || outdoor.length !== 1
    || components.length !== 2
    || duplicateIds.size > 0
    || invalidRole
    || invalidType
  ) {
    throw new TechnicalCatalogError(
      "Une combinaison split doit contenir exactement une unité intérieure et une unité extérieure valides.",
      "INVALID_COMPONENT",
    );
  }
}

function assertExpectedEquipment(
  equipment: CombinationEquipment | null,
  expectedType: "INDOOR_UNIT" | "OUTDOOR_UNIT",
  manufacturerId: string,
  currentEquipmentId?: string,
): asserts equipment is CombinationEquipment {
  const label = expectedType === "INDOOR_UNIT"
    ? "L’unité intérieure"
    : "L’unité extérieure";

  if (!equipment) {
    throw new TechnicalCatalogError(
      `${label} sélectionnée n’existe plus.`,
      "NOT_FOUND",
    );
  }
  if (equipment.type !== expectedType) {
    throw new TechnicalCatalogError(
      `${label} sélectionnée n’a pas le bon type d’équipement.`,
      "INVALID_COMPONENT",
    );
  }
  if (equipment.manufacturerId !== manufacturerId) {
    throw new TechnicalCatalogError(
      `${label} appartient à un autre fabricant.`,
      "INVALID_COMPONENT",
    );
  }
  if (!equipment.active && equipment.id !== currentEquipmentId) {
    throw new TechnicalCatalogError(
      `${label} est inactive et ne peut pas être sélectionnée.`,
      "INACTIVE_COMPONENT",
    );
  }
}

export async function validateCombination(
  lookup: CombinationLookup,
  input: CombinationInput,
  options: CombinationValidationOptions = {},
) {
  if (input.indoorEquipmentId === input.outdoorEquipmentId) {
    throw new TechnicalCatalogError(
      "Un même équipement ne peut pas occuper les deux rôles.",
      "INVALID_COMPONENT",
    );
  }

  const [manufacturer, productRange, indoorEquipment, outdoorEquipment] =
    await Promise.all([
      lookup.findManufacturer(input.manufacturerId),
      input.productRangeId
        ? lookup.findProductRange(input.productRangeId)
        : Promise.resolve(null),
      lookup.findEquipment(input.indoorEquipmentId),
      lookup.findEquipment(input.outdoorEquipmentId),
    ]);

  if (!manufacturer) {
    throw new TechnicalCatalogError(
      "Le fabricant sélectionné n’existe plus.",
      "NOT_FOUND",
    );
  }
  if (input.productRangeId && !productRange) {
    throw new TechnicalCatalogError(
      "La gamme sélectionnée n’existe plus.",
      "NOT_FOUND",
    );
  }
  if (
    productRange
    && productRange.manufacturerId !== input.manufacturerId
  ) {
    throw new TechnicalCatalogError(
      "La gamme sélectionnée appartient à un autre fabricant.",
      "RANGE_MANUFACTURER_MISMATCH",
    );
  }

  assertExpectedEquipment(
    indoorEquipment,
    "INDOOR_UNIT",
    input.manufacturerId,
    options.currentIndoorEquipmentId,
  );
  assertExpectedEquipment(
    outdoorEquipment,
    "OUTDOOR_UNIT",
    input.manufacturerId,
    options.currentOutdoorEquipmentId,
  );
  assertValidSplitComponents([
    {
      equipmentId: indoorEquipment.id,
      role: "INDOOR_UNIT",
      equipmentType: indoorEquipment.type,
    },
    {
      equipmentId: outdoorEquipment.id,
      role: "OUTDOOR_UNIT",
      equipmentType: outdoorEquipment.type,
    },
  ]);

  const duplicatePair = await lookup.findCombinationPairDuplicate(
    input.manufacturerId,
    input.indoorEquipmentId,
    input.outdoorEquipmentId,
    options.combinationId,
  );
  if (duplicatePair) {
    throw new TechnicalCatalogError(
      "Cette paire d’unités intérieure et extérieure existe déjà.",
      "DUPLICATE",
    );
  }

  const generatedName =
    `${outdoorEquipment.manufacturerReference} + ${indoorEquipment.manufacturerReference}`;
  const name = cleanCatalogName(input.name || generatedName);
  const normalizedName = normalizeCatalogName(name);
  const duplicateName = await lookup.findCombinationNameDuplicate(
    input.manufacturerId,
    normalizedName,
    options.combinationId,
  );
  if (duplicateName) {
    throw new TechnicalCatalogError(
      "Une combinaison portant ce nom existe déjà pour ce fabricant.",
      "DUPLICATE",
    );
  }

  return {
    combination: {
      manufacturerId: input.manufacturerId,
      productRangeId: input.productRangeId,
      name,
      normalizedName,
      applicationType: input.applicationType,
      splitLiaisonType: input.splitLiaisonType,
      electricalSupply: input.electricalSupply,
      nominalPowerKw: input.nominalPowerKw,
      commissioningNotes: input.commissioningNotes,
      installationNotes: input.installationNotes,
      internalNotes: input.internalNotes,
      active: input.active,
    },
    indoorEquipment,
    outdoorEquipment,
  };
}

export function combinationStatusData(active: boolean) {
  return { active };
}
