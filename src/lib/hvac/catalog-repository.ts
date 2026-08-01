import type { EquipmentType, Prisma } from "@/generated/prisma/client";
import { TechnicalCatalogError } from "@/lib/hvac/errors";
import { prisma } from "@/lib/prisma";
import type { CatalogLookup } from "@/lib/hvac/catalog-service";

function excluding(id?: string) {
  return id ? { not: id } : undefined;
}

export const technicalCatalogRepository: CatalogLookup = {
  findManufacturer(id) {
    return prisma.manufacturer.findUnique({
      where: { id },
      select: { id: true },
    });
  },

  findManufacturerDuplicate(normalizedName, excludeId) {
    return prisma.manufacturer.findFirst({
      where: {
        normalizedName,
        id: excluding(excludeId),
      },
      select: { id: true },
    });
  },

  findProductRange(id) {
    return prisma.productRange.findUnique({
      where: { id },
      select: { id: true, manufacturerId: true },
    });
  },

  findProductRangeDuplicate(manufacturerId, normalizedName, excludeId) {
    return prisma.productRange.findFirst({
      where: {
        manufacturerId,
        normalizedName,
        id: excluding(excludeId),
      },
      select: { id: true },
    });
  },

  findEquipmentDuplicate(manufacturerId, normalizedReference, excludeId) {
    return prisma.equipment.findFirst({
      where: {
        manufacturerId,
        normalizedReference,
        id: excluding(excludeId),
      },
      select: { id: true },
    });
  },
};

interface AuditContext {
  userId: string;
  action: string;
  entityType: "Manufacturer" | "ProductRange" | "Equipment";
  metadata?: Prisma.InputJsonValue;
}

function auditData(audit: AuditContext, entityId: string) {
  return {
    userId: audit.userId,
    action: audit.action,
    entityType: audit.entityType,
    entityId,
    metadata: audit.metadata,
  };
}

export function createManufacturerRecord(
  data: Prisma.ManufacturerUncheckedCreateInput,
  userId: string,
) {
  return prisma.$transaction(async (transaction) => {
    const entity = await transaction.manufacturer.create({ data });
    await transaction.auditLog.create({
      data: auditData({
        userId,
        action: "HVAC_MANUFACTURER_CREATE",
        entityType: "Manufacturer",
      }, entity.id),
    });
    return entity;
  });
}

export async function updateManufacturerRecord(
  id: string,
  data: Prisma.ManufacturerUncheckedUpdateInput,
  userId: string,
) {
  await prisma.$transaction([
    prisma.manufacturer.update({ where: { id }, data }),
    prisma.auditLog.create({
      data: {
        userId,
        action: "HVAC_MANUFACTURER_UPDATE",
        entityType: "Manufacturer",
        entityId: id,
      },
    }),
  ]);
}

export async function toggleManufacturerRecord(
  id: string,
  active: boolean,
  userId: string,
) {
  await prisma.$transaction([
    prisma.manufacturer.update({ where: { id }, data: { active } }),
    prisma.auditLog.create({
      data: {
        userId,
        action: active
          ? "HVAC_MANUFACTURER_ENABLE"
          : "HVAC_MANUFACTURER_DISABLE",
        entityType: "Manufacturer",
        entityId: id,
      },
    }),
  ]);
}

export function createProductRangeRecord(
  data: Prisma.ProductRangeUncheckedCreateInput,
  userId: string,
) {
  return prisma.$transaction(async (transaction) => {
    const entity = await transaction.productRange.create({ data });
    await transaction.auditLog.create({
      data: auditData({
        userId,
        action: "HVAC_PRODUCT_RANGE_CREATE",
        entityType: "ProductRange",
      }, entity.id),
    });
    return entity;
  });
}

export async function updateProductRangeRecord(
  id: string,
  data: Prisma.ProductRangeUncheckedUpdateInput,
  userId: string,
) {
  await prisma.$transaction([
    prisma.productRange.update({ where: { id }, data }),
    prisma.auditLog.create({
      data: {
        userId,
        action: "HVAC_PRODUCT_RANGE_UPDATE",
        entityType: "ProductRange",
        entityId: id,
      },
    }),
  ]);
}

export async function toggleProductRangeRecord(
  id: string,
  active: boolean,
  userId: string,
) {
  await prisma.$transaction([
    prisma.productRange.update({ where: { id }, data: { active } }),
    prisma.auditLog.create({
      data: {
        userId,
        action: active
          ? "HVAC_PRODUCT_RANGE_ENABLE"
          : "HVAC_PRODUCT_RANGE_DISABLE",
        entityType: "ProductRange",
        entityId: id,
      },
    }),
  ]);
}

export function createEquipmentRecord(
  data: Prisma.EquipmentUncheckedCreateInput,
  userId: string,
) {
  return prisma.$transaction(async (transaction) => {
    const entity = await transaction.equipment.create({ data });
    await transaction.auditLog.create({
      data: auditData({
        userId,
        action: "HVAC_EQUIPMENT_CREATE",
        entityType: "Equipment",
      }, entity.id),
    });
    return entity;
  });
}

export async function updateEquipmentRecord(
  id: string,
  data: Prisma.EquipmentUncheckedUpdateInput,
  userId: string,
) {
  await prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`
      SELECT "id" FROM "Equipment" WHERE "id" = ${id} FOR UPDATE
    `;
    const before = await transaction.equipment.findUnique({
      where: { id },
      include: {
        combinationParts: {
          include: {
            systemCombination: {
              select: {
                id: true,
                name: true,
                manufacturerId: true,
                indoorEquipmentId: true,
                outdoorEquipmentId: true,
              },
            },
          },
        },
      },
    });
    if (!before) {
      throw new TechnicalCatalogError(
        "L’équipement n’existe plus.",
        "NOT_FOUND",
      );
    }

    const nextManufacturerId = String(
      data.manufacturerId ?? before.manufacturerId,
    );
    const nextType = String(data.type ?? before.type) as EquipmentType;
    const manufacturer = await transaction.manufacturer.findUnique({
      where: { id: nextManufacturerId },
      select: { id: true },
    });
    if (!manufacturer) {
      throw new TechnicalCatalogError(
        "Le fabricant sélectionné n’existe plus.",
        "NOT_FOUND",
      );
    }
    const nextProductRangeId =
      data.productRangeId === undefined
        ? before.productRangeId
        : data.productRangeId == null
          ? null
          : String(data.productRangeId);
    if (nextProductRangeId) {
      const productRange = await transaction.productRange.findUnique({
        where: { id: nextProductRangeId },
        select: { manufacturerId: true },
      });
      if (!productRange) {
        throw new TechnicalCatalogError(
          "La gamme sélectionnée n’existe plus.",
          "NOT_FOUND",
        );
      }
      if (productRange.manufacturerId !== nextManufacturerId) {
        throw new TechnicalCatalogError(
          "La gamme sélectionnée appartient à un autre fabricant.",
          "RANGE_MANUFACTURER_MISMATCH",
        );
      }
    }

    const normalizedReference = String(
      data.normalizedReference ?? before.normalizedReference,
    );
    const duplicate = await transaction.equipment.findFirst({
      where: {
        manufacturerId: nextManufacturerId,
        normalizedReference,
        id: { not: id },
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new TechnicalCatalogError(
        "Cette référence existe déjà pour ce fabricant.",
        "DUPLICATE",
      );
    }

    const blockers = before.combinationParts.filter((part) => {
      const combination = part.systemCombination;
      const expectedType = part.role;
      const canonicalId = expectedType === "INDOOR_UNIT"
        ? combination.indoorEquipmentId
        : combination.outdoorEquipmentId;
      return (
        nextType !== expectedType
        || nextManufacturerId !== combination.manufacturerId
        || canonicalId !== id
      );
    });
    if (blockers.length > 0) {
      const details = blockers
        .map((part) => (
          `${part.systemCombination.name} `
          + `(/pac/technical/combinations/${part.systemCombination.id})`
        ))
        .join(", ");
      throw new TechnicalCatalogError(
        `Cette modification invaliderait les combinaisons suivantes : ${details}.`,
        "DEPENDENCY_CONFLICT",
      );
    }

    const referenceNeedsReview =
      normalizedReference === before.normalizedReference
        ? before.referenceNeedsReview
        : false;
    const after = await transaction.equipment.update({
      where: { id },
      data: {
        ...data,
        referenceNeedsReview,
      },
    });
    await transaction.auditLog.create({
      data: {
        userId,
        action: "HVAC_EQUIPMENT_UPDATE",
        entityType: "Equipment",
        entityId: id,
        metadata: {
          before: {
            manufacturerId: before.manufacturerId,
            productRangeId: before.productRangeId,
            type: before.type,
            manufacturerReference: before.manufacturerReference,
            normalizedReference: before.normalizedReference,
            active: before.active,
          },
          after: {
            manufacturerId: after.manufacturerId,
            productRangeId: after.productRangeId,
            type: after.type,
            manufacturerReference: after.manufacturerReference,
            normalizedReference: after.normalizedReference,
            active: after.active,
          },
        },
      },
    });
  }, {
    isolationLevel: "Serializable",
  });
}

export async function toggleEquipmentRecord(
  id: string,
  active: boolean,
  userId: string,
) {
  await prisma.$transaction([
    prisma.equipment.update({ where: { id }, data: { active } }),
    prisma.auditLog.create({
      data: {
        userId,
        action: active ? "HVAC_EQUIPMENT_ENABLE" : "HVAC_EQUIPMENT_DISABLE",
        entityType: "Equipment",
        entityId: id,
      },
    }),
  ]);
}

export function findEquipmentReferenceState(id: string) {
  return prisma.equipment.findUnique({
    where: { id },
    select: {
      id: true,
      normalizedReference: true,
      referenceNeedsReview: true,
    },
  });
}

export function findProductRangeChangeState(id: string) {
  return prisma.productRange.findUnique({
    where: { id },
    select: {
      id: true,
      manufacturerId: true,
      _count: {
        select: {
          equipment: true,
          systemCombinations: true,
        },
      },
    },
  });
}
