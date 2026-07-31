import { prisma } from "@/lib/prisma";
import type { CatalogCategory } from "./types";

export async function getActiveCatalog(): Promise<CatalogCategory[]> {
  return prisma.materialCategory.findMany({
    where: { active: true },
    orderBy: { position: "asc" },
    select: {
      id: true,
      name: true,
      materials: {
        where: { active: true },
        orderBy: { position: "asc" },
        select: {
          id: true,
          key: true,
          name: true,
          reportLabel: true,
          inputType: true,
          unit: true,
          defaultQuantity: true,
          detailLabel: true,
          allowSupplier: true,
          allowNotInstalled: true,
          variants: {
            where: { active: true },
            orderBy: { position: "asc" },
            select: { id: true, name: true, reportLabel: true },
          },
        },
      },
    },
  });
}
