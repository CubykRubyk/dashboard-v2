import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { EquipmentType } from "@/generated/prisma/enums";
import {
  normalizeCatalogName,
  normalizeEquipmentReference,
} from "@/lib/hvac/normalization";
import { prisma } from "@/lib/prisma";

export const COMBINATION_PAGE_SIZE = 25;

export interface CombinationListFilters {
  query: string;
  manufacturerId: string;
  productRangeId: string;
  active: "active" | "inactive" | "all";
  review: "" | "required" | "verified";
  page: number;
}

export function combinationListWhere(
  filters: CombinationListFilters,
): Prisma.SystemCombinationWhereInput {
  const normalizedName = normalizeCatalogName(filters.query);
  const normalizedReference = normalizeEquipmentReference(filters.query);
  return {
    ...(filters.manufacturerId
      ? { manufacturerId: filters.manufacturerId }
      : {}),
    ...(filters.productRangeId
      ? { productRangeId: filters.productRangeId }
      : {}),
    ...(filters.active === "inactive"
      ? { active: false }
      : filters.active === "all"
        ? {}
        : { active: true }),
    ...(filters.review === "required"
      ? {
          components: {
            some: { equipment: { referenceNeedsReview: true } },
          },
        }
      : filters.review === "verified"
        ? {
            components: {
              none: { equipment: { referenceNeedsReview: true } },
            },
          }
        : {}),
    ...(filters.query
      ? {
          OR: [
            { name: { contains: filters.query, mode: "insensitive" } },
            { normalizedName: { contains: normalizedName } },
            {
              manufacturer: {
                name: { contains: filters.query, mode: "insensitive" },
              },
            },
            {
              productRange: {
                name: { contains: filters.query, mode: "insensitive" },
              },
            },
            {
              components: {
                some: {
                  equipment: {
                    OR: [
                      {
                        manufacturerReference: {
                          contains: filters.query,
                          mode: "insensitive",
                        },
                      },
                      {
                        normalizedReference: {
                          contains: normalizedReference,
                        },
                      },
                      {
                        name: {
                          contains: filters.query,
                          mode: "insensitive",
                        },
                      },
                    ],
                  },
                },
              },
            },
          ],
        }
      : {}),
  };
}

export async function getCombinationList(filters: CombinationListFilters) {
  const where = combinationListWhere(filters);
  const [total, overallTotal, combinations] = await Promise.all([
    prisma.systemCombination.count({ where }),
    prisma.systemCombination.count(),
    prisma.systemCombination.findMany({
      where,
      orderBy: [
        { active: "desc" },
        { manufacturer: { name: "asc" } },
        { name: "asc" },
      ],
      skip: (filters.page - 1) * COMBINATION_PAGE_SIZE,
      take: COMBINATION_PAGE_SIZE,
      include: {
        manufacturer: { select: { name: true } },
        productRange: { select: { name: true } },
        components: {
          where: {
            role: {
              in: [
                EquipmentType.INDOOR_UNIT,
                EquipmentType.OUTDOOR_UNIT,
              ],
            },
          },
          orderBy: { position: "asc" },
          select: {
            role: true,
            equipment: {
              select: {
                manufacturerReference: true,
                name: true,
                type: true,
                active: true,
                referenceNeedsReview: true,
              },
            },
          },
        },
      },
    }),
  ]);
  return { total, overallTotal, combinations };
}

export function getCombinationFilterOptions() {
  return Promise.all([
    prisma.manufacturer.findMany({
      orderBy: [{ active: "desc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.productRange.findMany({
      orderBy: [
        { manufacturer: { name: "asc" } },
        { active: "desc" },
        { name: "asc" },
      ],
      select: { id: true, manufacturerId: true, name: true },
    }),
  ]);
}

export function getCombinationFormOptions() {
  return Promise.all([
    prisma.manufacturer.findMany({
      orderBy: [{ active: "desc" }, { name: "asc" }],
      select: { id: true, name: true, active: true },
    }),
    prisma.productRange.findMany({
      orderBy: [{ active: "desc" }, { name: "asc" }],
      select: {
        id: true,
        manufacturerId: true,
        name: true,
        active: true,
      },
    }),
    prisma.equipment.findMany({
      where: {
        type: {
          in: [
            EquipmentType.INDOOR_UNIT,
            EquipmentType.OUTDOOR_UNIT,
          ],
        },
      },
      orderBy: [
        { active: "desc" },
        { manufacturerReference: "asc" },
      ],
      select: {
        id: true,
        manufacturerId: true,
        manufacturerReference: true,
        name: true,
        type: true,
        active: true,
        referenceNeedsReview: true,
        productRange: { select: { name: true } },
      },
    }),
  ]);
}

export function getCombinationDetail(id: string) {
  return prisma.systemCombination.findUnique({
    where: { id },
    include: {
      manufacturer: true,
      productRange: true,
      components: {
        orderBy: { position: "asc" },
        include: {
          equipment: {
            include: {
              manufacturer: true,
              productRange: true,
              refrigerant: true,
            },
          },
        },
      },
      technicalDocuments: {
        orderBy: { createdAt: "desc" },
        include: {
          technicalDocument: true,
        },
      },
      legacyMappings: {
        select: { heatPumpId: true },
      },
    },
  });
}
