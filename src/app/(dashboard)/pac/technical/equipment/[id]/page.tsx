import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Boxes,
} from "lucide-react";
import { CatalogStatusToggle } from "@/components/pac/technical/CatalogStatusToggle";
import { EquipmentForm } from "@/components/pac/technical/EquipmentForm";
import { EquipmentCombinations } from "@/components/pac/technical/EquipmentCombinations";
import { TechnicalDocumentLinks } from "@/components/pac/technical/TechnicalDocumentLinks";
import { canManageTechnicalCatalog } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/session";
import { equipmentTypeLabels } from "@/lib/hvac/labels";
import { prisma } from "@/lib/prisma";
import {
  toggleEquipmentAction,
  updateEquipmentAction,
} from "../../actions";

export const dynamic = "force-dynamic";

export default async function EquipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [user, equipment, manufacturers, productRanges, refrigerants] =
    await Promise.all([
      getSession(),
      prisma.equipment.findUnique({
        where: { id },
        include: {
          manufacturer: true,
          productRange: true,
          _count: {
            select: {
              combinationParts: true,
              technicalDocuments: true,
              legacyMappings: true,
            },
          },
          combinationParts: {
            orderBy: {
              systemCombination: { name: "asc" },
            },
            include: {
              systemCombination: {
                include: {
                  components: {
                    orderBy: { position: "asc" },
                    select: {
                      role: true,
                      equipment: {
                        select: {
                          id: true,
                          manufacturerReference: true,
                          name: true,
                          active: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          technicalDocuments: {
            orderBy: {
              technicalDocument: { updatedAt: "desc" },
            },
            select: {
              technicalDocument: {
                select: {
                  id: true,
                  title: true,
                  type: true,
                  originalFileName: true,
                  sizeBytes: true,
                  active: true,
                },
              },
            },
          },
        },
      }),
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
      prisma.refrigerant.findMany({
        orderBy: [{ active: "desc" }, { name: "asc" }],
        select: { id: true, name: true, gwp: true, active: true },
      }),
    ]);
  if (!equipment) notFound();
  const canManage = canManageTechnicalCatalog(user?.role);

  return (
    <>
      <div className="page-heading technical-detail-heading">
        <div>
          <Link className="page-back-link" href="/pac/technical">
            <ArrowLeft size={15} /> Retour aux équipements
          </Link>
          <p className="eyebrow">{equipment.manufacturer.name}</p>
          <h1>{equipment.manufacturerReference}</h1>
          <p>{equipment.name}</p>
          <div className="technical-detail-badges">
            <span className={`equipment-type-badge type-${equipment.type.toLowerCase()}`}>
              {equipmentTypeLabels[equipment.type]}
            </span>
            <span className={`status-dot ${equipment.active ? "active" : ""}`}>
              {equipment.active ? "Actif" : "Inactif"}
            </span>
            {equipment.referenceNeedsReview && (
              <span className="technical-review-badge">
                <AlertTriangle size={13} /> Référence à vérifier
              </span>
            )}
          </div>
        </div>
        {canManage && (
          <CatalogStatusToggle
            action={toggleEquipmentAction.bind(null, equipment.id, !equipment.active)}
            active={equipment.active}
          />
        )}
      </div>

      <section className="technical-detail-stats">
        <div className="card">
          <Boxes size={18} />
          <span><strong>{equipment._count.combinationParts}</strong> combinaison(s)</span>
        </div>
        <div className="card">
          <span><strong>{equipment._count.technicalDocuments}</strong> document(s)</span>
        </div>
        <div className="card">
          <span><strong>{equipment._count.legacyMappings}</strong> liaison(s) legacy</span>
        </div>
      </section>

      {!canManage && (
        <div className="alert alert-danger">
          Consultation seule. Les droits administrateur sont requis pour modifier.
        </div>
      )}

      <EquipmentCombinations
        equipmentId={equipment.id}
        combinations={equipment.combinationParts}
      />

      <TechnicalDocumentLinks
        documents={equipment.technicalDocuments.map(
          (link) => link.technicalDocument,
        )}
        description="Documents associés directement à cet équipement."
      />

      <EquipmentForm
        action={updateEquipmentAction.bind(null, equipment.id)}
        manufacturers={manufacturers}
        productRanges={productRanges}
        refrigerants={refrigerants}
        equipment={equipment}
        submitLabel="Enregistrer les modifications"
        readOnly={!canManage}
      />
    </>
  );
}
