import { normalizeCatalogName } from "@/lib/hvac/normalization";
import { TechnicalCatalogError } from "@/lib/hvac/errors";
import type { PlannedEquipment } from "@/lib/hvac/simple-pump-service";
import type { SimplePumpInput } from "@/lib/hvac/simple-pump-validation";
import { sharedPumpEquipmentData } from "@/lib/hvac/simple-pump-service";
import { prisma } from "@/lib/prisma";

export interface CreatedPump {
  equipmentIds: string[];
  productRangeId: string | null;
}

/**
 * Crée en une seule transaction : la gamme (si elle est nouvelle), les fiches `Equipment`
 * planifiées, et les liens vers les documents techniques choisis. Tout ou rien — une pompe
 * à moitié créée serait plus pénible à rattraper qu'un échec net.
 */
export async function createSimplePumpRecord(
  input: SimplePumpInput,
  planned: PlannedEquipment[],
  documentIds: string[],
  userId: string,
): Promise<CreatedPump> {
  return prisma.$transaction(async (transaction) => {
    const manufacturer = await transaction.manufacturer.findUnique({
      where: { id: input.manufacturerId },
      select: { id: true },
    });
    if (!manufacturer) {
      throw new TechnicalCatalogError("Le fabricant sélectionné n’existe plus.", "NOT_FOUND");
    }

    let productRangeId = input.productRangeId;
    if (input.newProductRangeName) {
      const normalizedName = normalizeCatalogName(input.newProductRangeName);
      // Une gamme homonyme peut déjà exister (saisie concurrente, ou l'utilisateur a tapé un nom
      // déjà présent au lieu de le choisir dans la liste) : on la réutilise plutôt que d'échouer
      // sur la contrainte d'unicité.
      const existing = await transaction.productRange.findFirst({
        where: { manufacturerId: input.manufacturerId, normalizedName },
        select: { id: true },
      });
      if (existing) {
        productRangeId = existing.id;
      } else {
        const created = await transaction.productRange.create({
          data: {
            manufacturerId: input.manufacturerId,
            name: input.newProductRangeName,
            normalizedName,
          },
        });
        productRangeId = created.id;
        await transaction.auditLog.create({
          data: {
            userId,
            action: "HVAC_RANGE_CREATE",
            entityType: "ProductRange",
            entityId: created.id,
            metadata: { name: created.name, viaSimplePumpForm: true },
          },
        });
      }
    } else if (productRangeId) {
      const range = await transaction.productRange.findUnique({
        where: { id: productRangeId },
        select: { manufacturerId: true },
      });
      if (!range) {
        throw new TechnicalCatalogError("La gamme sélectionnée n’existe plus.", "NOT_FOUND");
      }
      if (range.manufacturerId !== input.manufacturerId) {
        throw new TechnicalCatalogError(
          "La gamme sélectionnée appartient à un autre fabricant.",
          "RANGE_MANUFACTURER_MISMATCH",
        );
      }
    }

    const shared = sharedPumpEquipmentData(input);
    const equipmentIds: string[] = [];
    for (const item of planned) {
      const duplicate = await transaction.equipment.findFirst({
        where: {
          manufacturerId: input.manufacturerId,
          normalizedReference: item.normalizedReference,
        },
        select: { id: true },
      });
      if (duplicate) {
        throw new TechnicalCatalogError(
          `La référence « ${item.manufacturerReference} » existe déjà pour ce fabricant.`,
          "DUPLICATE",
        );
      }

      const equipment = await transaction.equipment.create({
        data: {
          ...shared,
          productRangeId,
          type: item.type,
          name: item.name,
          manufacturerReference: item.manufacturerReference,
          normalizedReference: item.normalizedReference,
          referenceNeedsReview: item.referenceNeedsReview,
        },
      });
      equipmentIds.push(equipment.id);
      await transaction.auditLog.create({
        data: {
          userId,
          action: "HVAC_EQUIPMENT_CREATE",
          entityType: "Equipment",
          entityId: equipment.id,
          metadata: {
            viaSimplePumpForm: true,
            configuration: input.configuration,
            referenceNeedsReview: item.referenceNeedsReview,
          },
        },
      });
    }

    if (documentIds.length > 0 && equipmentIds.length > 0) {
      const documents = await transaction.technicalDocument.findMany({
        where: { id: { in: documentIds } },
        select: { id: true },
      });
      if (documents.length !== documentIds.length) {
        throw new TechnicalCatalogError(
          "Un document sélectionné n’existe plus.",
          "NOT_FOUND",
        );
      }
      await transaction.equipmentTechnicalDocument.createMany({
        data: documents.flatMap((document) =>
          equipmentIds.map((equipmentId) => ({
            equipmentId,
            technicalDocumentId: document.id,
          })),
        ),
        skipDuplicates: true,
      });
    }

    return { equipmentIds, productRangeId: productRangeId ?? null };
  });
}
