import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { EquipmentType } from "@/generated/prisma/enums";
import type { CombinationInput } from "@/lib/hvac/combination-validation";
import {
  combinationStatusData,
  type CombinationLookup,
  validateCombination,
} from "@/lib/hvac/combination-service";
import { TechnicalCatalogError } from "@/lib/hvac/errors";
import { prisma } from "@/lib/prisma";

type Transaction = Prisma.TransactionClient;

function excluding(id?: string) {
  return id ? { not: id } : undefined;
}

function lookupFor(transaction: Transaction): CombinationLookup {
  return {
    findManufacturer(id) {
      return transaction.manufacturer.findUnique({
        where: { id },
        select: { id: true },
      });
    },
    findProductRange(id) {
      return transaction.productRange.findUnique({
        where: { id },
        select: { id: true, manufacturerId: true },
      });
    },
    findEquipment(id) {
      return transaction.equipment.findUnique({
        where: { id },
        select: {
          id: true,
          manufacturerId: true,
          manufacturerReference: true,
          name: true,
          type: true,
          active: true,
        },
      });
    },
    findCombinationPairDuplicate(
      _manufacturerId,
      indoorEquipmentId,
      outdoorEquipmentId,
      excludeCombinationId,
    ) {
      return transaction.systemCombination.findFirst({
        where: {
          id: excluding(excludeCombinationId),
          indoorEquipmentId,
          outdoorEquipmentId,
        },
        select: { id: true },
      });
    },
    findCombinationNameDuplicate(
      manufacturerId,
      normalizedName,
      excludeCombinationId,
    ) {
      return transaction.systemCombination.findFirst({
        where: {
          manufacturerId,
          normalizedName,
          id: excluding(excludeCombinationId),
        },
        select: { id: true },
      });
    },
  };
}

function componentCreateData(
  indoorEquipmentId: string,
  outdoorEquipmentId: string,
) {
  return [
    {
      equipmentId: indoorEquipmentId,
      role: EquipmentType.INDOOR_UNIT,
      quantity: 1,
      position: 0,
      required: true,
    },
    {
      equipmentId: outdoorEquipmentId,
      role: EquipmentType.OUTDOOR_UNIT,
      quantity: 1,
      position: 1,
      required: true,
    },
  ];
}

function componentIds(components: Array<{
  equipmentId: string;
  role: EquipmentType;
}>) {
  return {
    indoorEquipmentId: components.find(
      (component) => component.role === EquipmentType.INDOOR_UNIT,
    )?.equipmentId ?? null,
    outdoorEquipmentId: components.find(
      (component) => component.role === EquipmentType.OUTDOOR_UNIT,
    )?.equipmentId ?? null,
  };
}

function auditSnapshot(combination: {
  manufacturerId: string;
  productRangeId: string | null;
  name: string;
  normalizedName: string;
  applicationType: string | null;
  splitLiaisonType: string | null;
  electricalSupply: string | null;
  nominalPowerKw: number | null;
  commissioningNotes: string;
  installationNotes: string;
  internalNotes: string;
  active: boolean;
  indoorEquipmentId: string;
  outdoorEquipmentId: string;
  components: Array<{ equipmentId: string; role: EquipmentType }>;
}) {
  return {
    manufacturerId: combination.manufacturerId,
    productRangeId: combination.productRangeId,
    name: combination.name,
    normalizedName: combination.normalizedName,
    applicationType: combination.applicationType,
    splitLiaisonType: combination.splitLiaisonType,
    electricalSupply: combination.electricalSupply,
    nominalPowerKw: combination.nominalPowerKw,
    commissioningNotes: combination.commissioningNotes,
    installationNotes: combination.installationNotes,
    internalNotes: combination.internalNotes,
    active: combination.active,
    indoorEquipmentId: combination.indoorEquipmentId,
    outdoorEquipmentId: combination.outdoorEquipmentId,
    components: componentIds(combination.components),
  };
}

const combinationSnapshotSelect = {
  manufacturerId: true,
  productRangeId: true,
  name: true,
  normalizedName: true,
  applicationType: true,
  splitLiaisonType: true,
  electricalSupply: true,
  nominalPowerKw: true,
  commissioningNotes: true,
  installationNotes: true,
  internalNotes: true,
  active: true,
  indoorEquipmentId: true,
  outdoorEquipmentId: true,
  components: {
    select: {
      equipmentId: true,
      role: true,
    },
  },
} satisfies Prisma.SystemCombinationSelect;

export function createCombinationRecord(
  input: CombinationInput,
  userId: string,
) {
  return createCombinationRecordWithDatabase(prisma, input, userId);
}

export function createCombinationRecordWithDatabase(
  database: PrismaClient,
  input: CombinationInput,
  userId: string,
) {
  return database.$transaction(async (transaction) => {
    const validated = await validateCombination(
      lookupFor(transaction),
      input,
    );
    const created = await transaction.systemCombination.create({
      data: {
        ...validated.combination,
        indoorEquipmentId: validated.indoorEquipment.id,
        outdoorEquipmentId: validated.outdoorEquipment.id,
      },
      select: { id: true },
    });
    await transaction.combinationComponent.createMany({
      data: componentCreateData(
        validated.indoorEquipment.id,
        validated.outdoorEquipment.id,
      ).map((component) => ({
        ...component,
        systemCombinationId: created.id,
      })),
    });
    const entity = await transaction.systemCombination.findUniqueOrThrow({
      where: { id: created.id },
      select: {
        id: true,
        ...combinationSnapshotSelect,
      },
    });
    await transaction.auditLog.create({
      data: {
        userId,
        action: "HVAC_SYSTEM_COMBINATION_CREATE",
        entityType: "SystemCombination",
        entityId: entity.id,
        metadata: {
          after: auditSnapshot(entity),
        },
      },
    });
    return entity;
  }, {
    isolationLevel: "Serializable",
  });
}

export function updateCombinationRecord(
  id: string,
  input: CombinationInput,
  userId: string,
) {
  return prisma.$transaction(async (transaction) => {
    const before = await transaction.systemCombination.findUnique({
      where: { id },
      select: combinationSnapshotSelect,
    });
    if (!before) {
      throw new TechnicalCatalogError(
        "La combinaison n’existe plus.",
        "NOT_FOUND",
      );
    }
    const current = componentIds(before.components);
    const validated = await validateCombination(
      lookupFor(transaction),
      input,
      {
        combinationId: id,
        currentIndoorEquipmentId: current.indoorEquipmentId ?? undefined,
        currentOutdoorEquipmentId: current.outdoorEquipmentId ?? undefined,
      },
    );

    await transaction.combinationComponent.deleteMany({
      where: { systemCombinationId: id },
    });
    await transaction.systemCombination.update({
      where: { id },
      data: {
        ...validated.combination,
        indoorEquipmentId: validated.indoorEquipment.id,
        outdoorEquipmentId: validated.outdoorEquipment.id,
      },
    });
    await transaction.combinationComponent.createMany({
      data: componentCreateData(
        validated.indoorEquipment.id,
        validated.outdoorEquipment.id,
      ).map((component) => ({
        ...component,
        systemCombinationId: id,
      })),
    });
    const after = await transaction.systemCombination.findUniqueOrThrow({
      where: { id },
      select: combinationSnapshotSelect,
    });
    await transaction.auditLog.create({
      data: {
        userId,
        action: "HVAC_SYSTEM_COMBINATION_UPDATE",
        entityType: "SystemCombination",
        entityId: id,
        metadata: {
          before: auditSnapshot(before),
          after: auditSnapshot(after),
        },
      },
    });
    return after;
  }, {
    isolationLevel: "Serializable",
  });
}

export function toggleCombinationRecord(
  id: string,
  active: boolean,
  userId: string,
) {
  return prisma.$transaction(async (transaction) => {
    const before = await transaction.systemCombination.findUnique({
      where: { id },
      select: combinationSnapshotSelect,
    });
    if (!before) {
      throw new TechnicalCatalogError(
        "La combinaison n’existe plus.",
        "NOT_FOUND",
      );
    }
    const after = await transaction.systemCombination.update({
      where: { id },
      data: combinationStatusData(active),
      select: combinationSnapshotSelect,
    });
    await transaction.auditLog.create({
      data: {
        userId,
        action: active
          ? "HVAC_SYSTEM_COMBINATION_ENABLE"
          : "HVAC_SYSTEM_COMBINATION_DISABLE",
        entityType: "SystemCombination",
        entityId: id,
        metadata: {
          before: auditSnapshot(before),
          after: auditSnapshot(after),
        },
      },
    });
    return after;
  });
}
