import "server-only";

import type { Prisma } from "@/generated/prisma/client";
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
  await prisma.$transaction([
    prisma.equipment.update({ where: { id }, data }),
    prisma.auditLog.create({
      data: {
        userId,
        action: "HVAC_EQUIPMENT_UPDATE",
        entityType: "Equipment",
        entityId: id,
      },
    }),
  ]);
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
