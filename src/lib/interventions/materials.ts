import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * Matériel à poser sur une intervention, avec la documentation technique de chaque référence.
 *
 * Les documents accompagnent systématiquement les lignes : c'est tout l'objet de la
 * fonctionnalité — le technicien arrive sur le chantier et doit avoir les manuels du matériel
 * qu'il installe, sans nouvelle requête ni recherche dans le catalogue.
 */
export interface MaterialDocument {
  id: string;
  title: string;
  type: string;
  isPrimary: boolean;
}

export interface InterventionMaterialView {
  id: string;
  quantity: number;
  note: string;
  equipment: {
    id: string;
    name: string;
    reference: string;
    manufacturer: string;
    type: string;
  };
  documents: MaterialDocument[];
}

export async function loadInterventionMaterials(
  interventionId: string,
): Promise<InterventionMaterialView[]> {
  const rows = await prisma.interventionMaterial.findMany({
    where: { interventionId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      quantity: true,
      note: true,
      equipment: {
        select: {
          id: true,
          name: true,
          manufacturerReference: true,
          type: true,
          manufacturer: { select: { name: true } },
          technicalDocuments: {
            // Un document retiré du catalogue ne doit plus être proposé sur le terrain.
            where: { technicalDocument: { active: true } },
            select: {
              technicalDocument: {
                select: { id: true, title: true, type: true, isPrimary: true },
              },
            },
          },
        },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    quantity: row.quantity,
    note: row.note,
    equipment: {
      id: row.equipment.id,
      name: row.equipment.name,
      reference: row.equipment.manufacturerReference,
      manufacturer: row.equipment.manufacturer.name,
      type: row.equipment.type,
    },
    documents: row.equipment.technicalDocuments
      .map((link) => link.technicalDocument)
      // Le manuel principal en premier : c'est celui qu'on ouvre neuf fois sur dix.
      .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.title.localeCompare(b.title)),
  }));
}
