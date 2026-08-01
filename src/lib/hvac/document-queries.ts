import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { TechnicalDocumentType } from "@/generated/prisma/enums";
import { technicalDocumentTypeLabels } from "@/lib/hvac/labels";
import { normalizeEquipmentReference } from "@/lib/hvac/normalization";
import { prisma } from "@/lib/prisma";

export const DOCUMENT_PAGE_SIZE = 25;

export interface DocumentListFilters {
  query: string;
  type: TechnicalDocumentType | "";
  active: "active" | "inactive" | "all";
  manufacturerId: string;
  association: "" | "equipment" | "combination" | "unassociated";
  legacy: "" | "legacy" | "native";
  page: number;
}

export function documentListWhere(
  filters: DocumentListFilters,
): Prisma.TechnicalDocumentWhereInput {
  const normalizedReference = normalizeEquipmentReference(filters.query);
  const possibleType = filters.query
    .trim()
    .toUpperCase()
    .replace(/[\s/-]+/g, "_");
  const typeMatch = Object.values(TechnicalDocumentType).includes(
    possibleType as TechnicalDocumentType,
  )
    ? possibleType as TechnicalDocumentType
    : null;
  const typeMatches = Object.entries(technicalDocumentTypeLabels)
    .filter(([, label]) => label
      .toLocaleLowerCase("fr")
      .includes(filters.query.toLocaleLowerCase("fr")))
    .map(([type]) => type as TechnicalDocumentType);
  if (typeMatch && !typeMatches.includes(typeMatch)) typeMatches.push(typeMatch);

  return {
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.active === "inactive"
      ? { active: false }
      : filters.active === "all"
        ? {}
        : { active: true }),
    ...(filters.legacy === "legacy"
      ? { legacyPacDocumentId: { not: null } }
      : filters.legacy === "native"
        ? { legacyPacDocumentId: null }
        : {}),
    ...(filters.association === "equipment"
      ? { equipment: { some: {} } }
      : filters.association === "combination"
        ? { systemCombinations: { some: {} } }
        : filters.association === "unassociated"
          ? {
              AND: [
                { equipment: { none: {} } },
                { systemCombinations: { none: {} } },
              ],
            }
          : {}),
    ...(filters.manufacturerId
      ? {
          OR: [
            {
              equipment: {
                some: {
                  equipment: {
                    manufacturerId: filters.manufacturerId,
                  },
                },
              },
            },
            {
              systemCombinations: {
                some: {
                  systemCombination: {
                    manufacturerId: filters.manufacturerId,
                  },
                },
              },
            },
          ],
        }
      : {}),
    ...(filters.query
      ? {
          AND: [
            {
              OR: [
                {
                  title: {
                    contains: filters.query,
                    mode: "insensitive",
                  },
                },
                {
                  originalFileName: {
                    contains: filters.query,
                    mode: "insensitive",
                  },
                },
                {
                  version: {
                    contains: filters.query,
                    mode: "insensitive",
                  },
                },
                ...(typeMatches.length > 0
                  ? [{ type: { in: typeMatches } }]
                  : []),
                {
                  equipment: {
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
                          {
                            manufacturer: {
                              name: {
                                contains: filters.query,
                                mode: "insensitive",
                              },
                            },
                          },
                          {
                            productRange: {
                              name: {
                                contains: filters.query,
                                mode: "insensitive",
                              },
                            },
                          },
                        ],
                      },
                    },
                  },
                },
                {
                  systemCombinations: {
                    some: {
                      systemCombination: {
                        OR: [
                          {
                            name: {
                              contains: filters.query,
                              mode: "insensitive",
                            },
                          },
                          {
                            manufacturer: {
                              name: {
                                contains: filters.query,
                                mode: "insensitive",
                              },
                            },
                          },
                          {
                            productRange: {
                              name: {
                                contains: filters.query,
                                mode: "insensitive",
                              },
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
                      },
                    },
                  },
                },
              ],
            },
          ],
        }
      : {}),
  };
}

export async function getDocumentList(filters: DocumentListFilters) {
  const where = documentListWhere(filters);
  const [total, overallTotal, documents] = await Promise.all([
    prisma.technicalDocument.count({ where }),
    prisma.technicalDocument.count(),
    prisma.technicalDocument.findMany({
      where,
      orderBy: [
        { active: "desc" },
        { updatedAt: "desc" },
        { title: "asc" },
      ],
      skip: (filters.page - 1) * DOCUMENT_PAGE_SIZE,
      take: DOCUMENT_PAGE_SIZE,
      include: {
        _count: {
          select: {
            equipment: true,
            systemCombinations: true,
          },
        },
        equipment: {
          select: {
            equipment: {
              select: {
                manufacturer: { select: { name: true } },
              },
            },
          },
        },
        systemCombinations: {
          select: {
            systemCombination: {
              select: {
                manufacturer: { select: { name: true } },
              },
            },
          },
        },
      },
    }),
  ]);
  return { total, overallTotal, documents };
}

export function getDocumentFilterOptions() {
  return prisma.manufacturer.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: { id: true, name: true },
  });
}

export function getDocumentAssociationOptions() {
  return Promise.all([
    prisma.equipment.findMany({
      orderBy: [
        { active: "desc" },
        { manufacturer: { name: "asc" } },
        { manufacturerReference: "asc" },
      ],
      select: {
        id: true,
        manufacturerReference: true,
        normalizedReference: true,
        name: true,
        type: true,
        active: true,
        referenceNeedsReview: true,
        manufacturer: { select: { name: true } },
        productRange: { select: { name: true } },
      },
    }),
    prisma.systemCombination.findMany({
      orderBy: [
        { active: "desc" },
        { manufacturer: { name: "asc" } },
        { name: "asc" },
      ],
      select: {
        id: true,
        name: true,
        active: true,
        manufacturer: { select: { name: true } },
        productRange: { select: { name: true } },
        components: {
          where: { role: { in: ["INDOOR_UNIT", "OUTDOOR_UNIT"] } },
          orderBy: { position: "asc" },
          select: {
            role: true,
            equipment: {
              select: {
                manufacturerReference: true,
                normalizedReference: true,
                name: true,
                referenceNeedsReview: true,
              },
            },
          },
        },
      },
    }),
  ]);
}

export function getTechnicalDocumentDetail(id: string) {
  return prisma.technicalDocument.findUnique({
    where: { id },
    include: {
      legacyPacDocument: {
        select: {
          id: true,
          heatPumpId: true,
        },
      },
      equipment: {
        orderBy: {
          equipment: { manufacturerReference: "asc" },
        },
        include: {
          equipment: {
            include: {
              manufacturer: true,
              productRange: true,
            },
          },
        },
      },
      systemCombinations: {
        orderBy: {
          systemCombination: { name: "asc" },
        },
        include: {
          systemCombination: {
            include: {
              manufacturer: true,
              productRange: true,
              components: {
                where: { role: { in: ["INDOOR_UNIT", "OUTDOOR_UNIT"] } },
                orderBy: { position: "asc" },
                include: { equipment: true },
              },
            },
          },
        },
      },
    },
  });
}
