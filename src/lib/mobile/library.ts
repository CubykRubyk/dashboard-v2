import "server-only";

import { normalizeEquipmentReference } from "@/lib/hvac/normalization";
import { prisma } from "@/lib/prisma";

export interface LibraryDocument {
  id: string;
  title: string;
  type: string;
  isPrimary: boolean;
  sizeBytes: number;
}

export interface LibraryEquipment {
  id: string;
  name: string;
  reference: string;
  manufacturer: string;
  range: string | null;
  type: string;
  documents: LibraryDocument[];
}

const RESULT_LIMIT = 25;

/**
 * Recherche d'équipements pour la bibliothèque mobile.
 *
 * Reprend le filtre de la liste desktop (`/pac/technical`) : référence exacte, référence
 * normalisée (espaces et casse ignorés — un technicien tape rarement la référence au caractère
 * près), désignation, fabricant, gamme. Seuls les équipements actifs sont proposés, et seuls les
 * documents actifs sont joints : sur le terrain, une fiche retirée du catalogue ne doit pas
 * remonter.
 */
export async function searchLibrary(query: string): Promise<LibraryEquipment[]> {
  const trimmed = query.trim().slice(0, 160);
  if (trimmed.length < 2) return [];
  const normalized = normalizeEquipmentReference(trimmed);

  const rows = await prisma.equipment.findMany({
    where: {
      active: true,
      OR: [
        { manufacturerReference: { contains: trimmed, mode: "insensitive" } },
        { normalizedReference: { contains: normalized } },
        { name: { contains: trimmed, mode: "insensitive" } },
        { manufacturer: { name: { contains: trimmed, mode: "insensitive" } } },
        { productRange: { name: { contains: trimmed, mode: "insensitive" } } },
      ],
    },
    orderBy: [{ manufacturer: { name: "asc" } }, { manufacturerReference: "asc" }],
    take: RESULT_LIMIT,
    select: {
      id: true,
      name: true,
      manufacturerReference: true,
      type: true,
      manufacturer: { select: { name: true } },
      productRange: { select: { name: true } },
      technicalDocuments: {
        where: { technicalDocument: { active: true } },
        select: {
          technicalDocument: {
            select: { id: true, title: true, type: true, isPrimary: true, sizeBytes: true },
          },
        },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    reference: row.manufacturerReference,
    manufacturer: row.manufacturer.name,
    range: row.productRange?.name ?? null,
    type: row.type,
    documents: row.technicalDocuments
      .map((link) => link.technicalDocument)
      // Le manuel principal d'abord : c'est celui qu'on cherche neuf fois sur dix.
      .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.title.localeCompare(b.title)),
  }));
}
