import type { Prisma } from "@/generated/prisma/client";
import {
  assertDeletionConfirmation,
  assertEquipmentDeletionAllowed,
  type EquipmentDeletionBlocker,
} from "@/lib/hvac/deletion-service";
import { TechnicalCatalogError } from "@/lib/hvac/errors";
import { prisma } from "@/lib/prisma";

function auditJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function componentReferences(
  components: Array<{
    role: string;
    equipment: { manufacturerReference: string };
  }>,
) {
  return {
    indoorReference: components.find(
      (component) => component.role === "INDOOR_UNIT",
    )?.equipment.manufacturerReference ?? "—",
    outdoorReference: components.find(
      (component) => component.role === "OUTDOOR_UNIT",
    )?.equipment.manufacturerReference ?? "—",
  };
}

type Transaction = Prisma.TransactionClient;

async function loadCombinationDeletionSnapshot(
  transaction: Transaction,
  id: string,
) {
  const combination = await transaction.systemCombination.findUnique({
    where: { id },
  });
  if (!combination) return null;
  const manufacturer = await transaction.manufacturer.findUniqueOrThrow({
    where: { id: combination.manufacturerId },
    select: { id: true, name: true },
  });
  const productRange = combination.productRangeId
    ? await transaction.productRange.findUnique({
        where: { id: combination.productRangeId },
        select: { id: true, name: true },
      })
    : null;
  const componentRows = await transaction.combinationComponent.findMany({
    where: { systemCombinationId: id },
    orderBy: { position: "asc" },
  });
  const equipment = await transaction.equipment.findMany({
    where: { id: { in: componentRows.map((row) => row.equipmentId) } },
    select: {
      id: true,
      type: true,
      manufacturerReference: true,
      name: true,
    },
  });
  const equipmentById = new Map(equipment.map((item) => [item.id, item]));
  const technicalDocuments =
    await transaction.systemCombinationTechnicalDocument.findMany({
      where: { systemCombinationId: id },
      orderBy: { technicalDocumentId: "asc" },
      select: { technicalDocumentId: true },
    });
  const legacyMappings =
    await transaction.legacyHeatPumpSystemCombination.findMany({
      where: { systemCombinationId: id },
      orderBy: { heatPumpId: "asc" },
      select: { heatPumpId: true },
    });
  return {
    ...combination,
    manufacturer,
    productRange,
    components: componentRows.map((row) => ({
      ...row,
      equipment: equipmentById.get(row.equipmentId) ?? null,
    })),
    technicalDocuments,
    legacyMappings,
  };
}

async function loadEquipmentDeletionSnapshot(
  transaction: Transaction,
  id: string,
) {
  const equipment = await transaction.equipment.findUnique({ where: { id } });
  if (!equipment) return null;
  const manufacturer = await transaction.manufacturer.findUniqueOrThrow({
    where: { id: equipment.manufacturerId },
    select: { id: true, name: true },
  });
  const productRange = equipment.productRangeId
    ? await transaction.productRange.findUnique({
        where: { id: equipment.productRangeId },
        select: { id: true, name: true },
      })
    : null;
  const refrigerant = equipment.refrigerantId
    ? await transaction.refrigerant.findUnique({
        where: { id: equipment.refrigerantId },
        select: { id: true, name: true },
      })
    : null;
  const combinationParts = await transaction.combinationComponent.findMany({
    where: { equipmentId: id },
    select: { systemCombinationId: true },
  });
  const combinationIds = combinationParts.map(
    (part) => part.systemCombinationId,
  );
  const combinations = await transaction.systemCombination.findMany({
    where: { id: { in: combinationIds } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const allComponents = await transaction.combinationComponent.findMany({
    where: { systemCombinationId: { in: combinationIds } },
    orderBy: { position: "asc" },
    select: { systemCombinationId: true, equipmentId: true, role: true },
  });
  const componentEquipment = await transaction.equipment.findMany({
    where: {
      id: { in: allComponents.map((component) => component.equipmentId) },
    },
    select: { id: true, manufacturerReference: true },
  });
  const references = new Map(
    componentEquipment.map((item) => [item.id, item.manufacturerReference]),
  );
  const blockers: EquipmentDeletionBlocker[] = combinations.map(
    (combination) => ({
      id: combination.id,
      name: combination.name,
      ...componentReferences(
        allComponents
          .filter(
            (component) => (
              component.systemCombinationId === combination.id
            ),
          )
          .map((component) => ({
            role: component.role,
            equipment: {
              manufacturerReference:
                references.get(component.equipmentId) ?? "—",
            },
          })),
      ),
    }),
  );
  const technicalDocuments =
    await transaction.equipmentTechnicalDocument.findMany({
      where: { equipmentId: id },
      orderBy: { technicalDocumentId: "asc" },
      select: { technicalDocumentId: true },
    });
  const legacyMappings = await transaction.legacyHeatPumpEquipment.findMany({
    where: { equipmentId: id },
    orderBy: [{ heatPumpId: "asc" }, { role: "asc" }],
    select: { heatPumpId: true, role: true },
  });
  return {
    snapshot: {
      ...equipment,
      manufacturer,
      productRange,
      refrigerant,
      combinationParts: blockers,
      technicalDocuments,
      legacyMappings,
    },
    blockers,
  };
}

export async function getEquipmentDeletionBlockers(id: string) {
  const equipment = await prisma.equipment.findUnique({
    where: { id },
    select: {
      combinationParts: {
        orderBy: { systemCombination: { name: "asc" } },
        select: {
          systemCombination: {
            select: {
              id: true,
              name: true,
              components: {
                orderBy: { position: "asc" },
                select: {
                  role: true,
                  equipment: {
                    select: { manufacturerReference: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!equipment) return [];
  return equipment.combinationParts.map((part) => ({
    id: part.systemCombination.id,
    name: part.systemCombination.name,
    ...componentReferences(part.systemCombination.components),
  }));
}

function isConcurrencyOrForeignKeyError(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return false;
  return (
    error.code === "P2003"
    || error.code === "P2025"
    || error.code === "P2034"
  );
}

export async function deleteSystemCombinationRecord(
  id: string,
  confirmation: string,
  userId: string,
) {
  try {
    return await prisma.$transaction(async (transaction) => {
      const before = await loadCombinationDeletionSnapshot(transaction, id);
      if (!before) return { deleted: false as const };

      assertDeletionConfirmation(confirmation, before.name);
      const snapshot = {
        ...before,
        createdAt: before.createdAt.toISOString(),
        updatedAt: before.updatedAt.toISOString(),
      };

      await transaction.systemCombinationTechnicalDocument.deleteMany({
        where: { systemCombinationId: id },
      });
      await transaction.combinationComponent.deleteMany({
        where: { systemCombinationId: id },
      });
      await transaction.legacyHeatPumpSystemCombination.deleteMany({
        where: { systemCombinationId: id },
      });
      await transaction.systemCombination.delete({ where: { id } });
      await transaction.auditLog.create({
        data: {
          userId,
          action: "HVAC_SYSTEM_COMBINATION_DELETE",
          entityType: "SystemCombination",
          entityId: id,
          metadata: {
            before: auditJson(snapshot),
          },
        },
      });
      return { deleted: true as const };
    }, {
      isolationLevel: "Serializable",
    });
  } catch (error) {
    if (!isConcurrencyOrForeignKeyError(error)) throw error;
    const exists = await prisma.systemCombination.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) return { deleted: false as const };
    throw new TechnicalCatalogError(
      "La combinaison a changé pendant la suppression. Rechargez la page puis réessayez.",
      "DEPENDENCY_CONFLICT",
    );
  }
}

export async function deleteEquipmentRecord(
  id: string,
  confirmation: string,
  userId: string,
) {
  try {
    return await prisma.$transaction(async (transaction) => {
      const loaded = await loadEquipmentDeletionSnapshot(transaction, id);
      if (!loaded) return { deleted: false as const };
      const before = loaded.snapshot;

      assertDeletionConfirmation(
        confirmation,
        before.manufacturerReference,
      );
      assertEquipmentDeletionAllowed(loaded.blockers);
      const snapshot = {
        ...before,
        createdAt: before.createdAt.toISOString(),
        updatedAt: before.updatedAt.toISOString(),
      };

      await transaction.equipmentTechnicalDocument.deleteMany({
        where: { equipmentId: id },
      });
      await transaction.legacyHeatPumpEquipment.deleteMany({
        where: { equipmentId: id },
      });
      await transaction.equipment.delete({ where: { id } });
      await transaction.auditLog.create({
        data: {
          userId,
          action: "HVAC_EQUIPMENT_DELETE",
          entityType: "Equipment",
          entityId: id,
          metadata: {
            before: auditJson(snapshot),
          },
        },
      });
      return { deleted: true as const };
    }, {
      isolationLevel: "Serializable",
    });
  } catch (error) {
    if (!isConcurrencyOrForeignKeyError(error)) throw error;
    const exists = await prisma.equipment.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) return { deleted: false as const };
    const blockers = await getEquipmentDeletionBlockers(id);
    if (blockers.length > 0) {
      assertEquipmentDeletionAllowed(blockers);
    }
    throw new TechnicalCatalogError(
      "L’équipement a changé pendant la suppression. Rechargez la page puis réessayez.",
      "DEPENDENCY_CONFLICT",
    );
  }
}
