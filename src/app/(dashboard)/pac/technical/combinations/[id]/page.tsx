import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  FileText,
  Network,
} from "lucide-react";
import { CatalogStatusToggle } from "@/components/pac/technical/CatalogStatusToggle";
import { CombinationEquipmentCard } from "@/components/pac/technical/CombinationEquipmentCard";
import { CombinationForm } from "@/components/pac/technical/CombinationForm";
import { DeleteEntityDialog } from "@/components/pac/technical/DeleteEntityDialog";
import { TechnicalDocumentLinks } from "@/components/pac/technical/TechnicalDocumentLinks";
import { canManageTechnicalCatalog } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/session";
import {
  getCombinationDetail,
  getCombinationFormOptions,
} from "@/lib/hvac/combination-queries";
import { activeAssociatedDocuments } from "@/lib/hvac/deletion-service";
import {
  deleteCombinationAction,
  toggleCombinationAction,
  updateCombinationAction,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function CombinationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [user, combination, [manufacturers, productRanges, equipment]] =
    await Promise.all([
      getSession(),
      getCombinationDetail(id),
      getCombinationFormOptions(),
    ]);
  if (!combination) notFound();

  const indoorComponent = combination.components.find(
    (component) => component.role === "INDOOR_UNIT",
  );
  const outdoorComponent = combination.components.find(
    (component) => component.role === "OUTDOOR_UNIT",
  );
  const needsReview =
    indoorComponent?.equipment.referenceNeedsReview
    || outdoorComponent?.equipment.referenceNeedsReview;
  const canManage = canManageTechnicalCatalog(user?.role);
  const activeDocuments = activeAssociatedDocuments(
    combination.technicalDocuments.map((link) => link.technicalDocument),
  );
  const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <>
      <div className="page-heading technical-detail-heading">
        <div>
          <Link
            className="page-back-link"
            href="/pac/technical/combinations"
          >
            <ArrowLeft size={15} /> Retour aux combinaisons
          </Link>
          <p className="eyebrow">{combination.manufacturer.name}</p>
          <h1>{combination.name}</h1>
          <p>{combination.productRange?.name || "Combinaison sans gamme"}</p>
          <div className="technical-detail-badges">
            <span className={`status-dot ${combination.active ? "active" : ""}`}>
              {combination.active ? "Active" : "Inactive"}
            </span>
            {needsReview && (
              <span className="technical-review-badge">
                <AlertTriangle size={13} /> Référence à vérifier
              </span>
            )}
          </div>
        </div>
        {canManage && (
          <div className="page-heading-actions">
            <CatalogStatusToggle
              action={toggleCombinationAction.bind(
                null,
                combination.id,
                !combination.active,
              )}
              active={combination.active}
            />
            <DeleteEntityDialog
              action={deleteCombinationAction.bind(null, combination.id)}
              buttonLabel="Supprimer la combinaison"
              title="Supprimer cette combinaison ?"
              entityLabel={combination.name}
              expectedConfirmation={combination.name}
              facts={[
                `UE : ${outdoorComponent?.equipment.manufacturerReference ?? "manquante"}`,
                `UI : ${indoorComponent?.equipment.manufacturerReference ?? "manquante"}`,
                `${combination.technicalDocuments.length} association(s) document seront retirées, sans supprimer les documents ni les PDF.`,
                `${combination.legacyMappings.length} liaison(s) de traçabilité seront retirées, sans modifier HeatPump.`,
                "Les équipements UI et UE seront conservés.",
              ]}
            />
          </div>
        )}
      </div>

      <section className="technical-detail-stats">
        <div className="card">
          <Network size={18} />
          <span><strong>{combination.components.length}</strong> composant(s)</span>
        </div>
        <div className="card">
          <FileText size={18} />
          <span>
            <strong>{activeDocuments.length}</strong> document(s) actif(s)
          </span>
        </div>
        <div className="card">
          <CalendarDays size={18} />
          <span>Modifiée le <strong>{dateFormatter.format(combination.updatedAt)}</strong></span>
        </div>
      </section>

      {!canManage && (
        <div className="alert alert-danger">
          Consultation seule. Les droits administrateur sont requis pour modifier.
        </div>
      )}

      <div className="combination-equipment-pair">
        <CombinationEquipmentCard
          title="Unité extérieure"
          equipment={outdoorComponent?.equipment}
        />
        <CombinationEquipmentCard
          title="Unité intérieure"
          equipment={indoorComponent?.equipment}
        />
      </div>

      <section className="card combination-identification">
        <div>
          <p className="eyebrow">Traçabilité</p>
          <h2>Informations de la combinaison</h2>
        </div>
        <dl className="combination-technical-values">
          <div>
            <dt>Créée</dt>
            <dd>{dateFormatter.format(combination.createdAt)}</dd>
          </div>
          <div>
            <dt>Mise à jour</dt>
            <dd>{dateFormatter.format(combination.updatedAt)}</dd>
          </div>
          <div>
            <dt>Liaisons legacy</dt>
            <dd>{combination.legacyMappings.length}</dd>
          </div>
        </dl>
      </section>

      <CombinationForm
        action={updateCombinationAction.bind(null, combination.id)}
        manufacturers={manufacturers}
        productRanges={productRanges}
        equipment={equipment}
        combination={{
          manufacturerId: combination.manufacturerId,
          productRangeId: combination.productRangeId,
          name: combination.name,
          applicationType: combination.applicationType,
          splitLiaisonType: combination.splitLiaisonType,
          electricalSupply: combination.electricalSupply,
          nominalPowerKw: combination.nominalPowerKw,
          commissioningNotes: combination.commissioningNotes,
          installationNotes: combination.installationNotes,
          internalNotes: combination.internalNotes,
          active: combination.active,
          indoorEquipmentId: indoorComponent?.equipmentId || "",
          outdoorEquipmentId: outdoorComponent?.equipmentId || "",
        }}
        submitLabel="Enregistrer les modifications"
        readOnly={!canManage}
      />

      <TechnicalDocumentLinks
        title="Documents de la combinaison"
        description="Associations directes, sans mélanger les documents des composants."
        documents={activeDocuments}
      />
    </>
  );
}
