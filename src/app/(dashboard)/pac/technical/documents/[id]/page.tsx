import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Download,
  ExternalLink,
  FileCheck2,
  FileWarning,
  History,
} from "lucide-react";
import { CatalogStatusToggle } from "@/components/pac/technical/CatalogStatusToggle";
import { TechnicalDocumentAssociations } from "@/components/pac/technical/TechnicalDocumentAssociations";
import { TechnicalDocumentForm } from "@/components/pac/technical/TechnicalDocumentForm";
import { canManageTechnicalCatalog } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/session";
import {
  formatDocumentSize,
  technicalDocumentFileHref,
} from "@/lib/hvac/document-format";
import {
  getDocumentAssociationOptions,
  getTechnicalDocumentDetail,
} from "@/lib/hvac/document-queries";
import {
  checksumStoredTechnicalDocument,
  technicalDocumentFileExists,
} from "@/lib/hvac/document-storage";
import { technicalDocumentTypeLabels } from "@/lib/hvac/labels";
import {
  toggleTechnicalDocumentAction,
  updateTechnicalDocumentAction,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function TechnicalDocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [user, document, [equipmentOptions, combinationOptions]] =
    await Promise.all([
      getSession(),
      getTechnicalDocumentDetail(id),
      getDocumentAssociationOptions(),
    ]);
  if (!document) notFound();

  const fileExists = await technicalDocumentFileExists(document.storageName);
  let displayedChecksum = document.checksumSha256;
  if (!displayedChecksum && fileExists) {
    try {
      displayedChecksum = await checksumStoredTechnicalDocument(
        document.storageName,
      );
    } catch {
      displayedChecksum = null;
    }
  }
  const canManage = canManageTechnicalCatalog(user?.role);
  const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const associatedEquipment = document.equipment.map(
    (link) => link.equipment,
  );
  const associatedCombinations = document.systemCombinations.map(
    (link) => link.systemCombination,
  );

  return (
    <>
      <div className="page-heading technical-detail-heading">
        <div>
          <Link
            className="page-back-link"
            href="/pac/technical/documents"
          >
            <ArrowLeft size={15} /> Retour aux documents
          </Link>
          <p className="eyebrow">
            {technicalDocumentTypeLabels[document.type]}
          </p>
          <h1>{document.title}</h1>
          <p>{document.originalFileName}</p>
          <div className="technical-detail-badges">
            <span className={`status-dot ${document.active ? "active" : ""}`}>
              {document.active ? "Actif" : "Inactif"}
            </span>
            {document.legacyPacDocumentId && (
              <span className="document-origin-badge">Migration legacy</span>
            )}
            {document.isPrimary && (
              <span className="equipment-type-badge">Document principal</span>
            )}
          </div>
        </div>
        {canManage && (
          <CatalogStatusToggle
            action={toggleTechnicalDocumentAction.bind(
              null,
              document.id,
              !document.active,
            )}
            active={document.active}
          />
        )}
      </div>

      {!canManage && (
        <div className="alert alert-danger">
          Consultation seule. Les droits administrateur sont requis pour modifier.
        </div>
      )}

      <section className="card technical-document-file-card">
        <div className="technical-document-file-summary">
          <span className={`technical-document-file-icon ${fileExists ? "available" : ""}`}>
            {fileExists ? <FileCheck2 size={25} /> : <FileWarning size={25} />}
          </span>
          <div>
            <h2>{document.originalFileName}</h2>
            <p>
              application/pdf · {formatDocumentSize(document.sizeBytes)}
              {document.version ? ` · version ${document.version}` : ""}
            </p>
          </div>
        </div>
        {fileExists ? (
          <div className="page-heading-actions">
            <Link
              className="button button-primary"
              href={technicalDocumentFileHref(document.id)}
              target="_blank"
            >
              <ExternalLink size={16} /> Visualiser
            </Link>
            <Link
              className="button button-ghost"
              href={technicalDocumentFileHref(document.id, true)}
            >
              <Download size={16} /> Télécharger
            </Link>
          </div>
        ) : (
          <div className="alert alert-danger">
            Les métadonnées existent, mais le fichier physique est absent du storage.
          </div>
        )}
      </section>

      <section className="card technical-document-metadata">
        <div>
          <p className="eyebrow">Informations</p>
          <h2>Métadonnées et traçabilité</h2>
        </div>
        <dl className="combination-technical-values">
          <div>
            <dt>Type</dt>
            <dd>{technicalDocumentTypeLabels[document.type]}</dd>
          </div>
          <div>
            <dt>Date document</dt>
            <dd>
              {document.documentDate
                ? dateFormatter.format(document.documentDate)
                : "Non renseignée"}
            </dd>
          </div>
          <div>
            <dt>Créé</dt>
            <dd>{dateFormatter.format(document.createdAt)}</dd>
          </div>
          <div>
            <dt>Mis à jour</dt>
            <dd>{dateFormatter.format(document.updatedAt)}</dd>
          </div>
          <div className="document-checksum-value">
            <dt>SHA-256</dt>
            <dd>
              <code>{displayedChecksum || "Non calculé"}</code>
              {!document.checksumSha256 && displayedChecksum && (
                <small>Calculé à la lecture pour ce document legacy</small>
              )}
            </dd>
          </div>
          <div>
            <dt>Origine</dt>
            <dd>
              {document.legacyPacDocument ? (
                <Link href={`/pac/${document.legacyPacDocument.heatPumpId}`}>
                  <History size={14} /> Document PAC legacy
                </Link>
              ) : "Bibliothèque technique"}
            </dd>
          </div>
        </dl>
      </section>

      <TechnicalDocumentAssociations
        equipment={associatedEquipment}
        combinations={associatedCombinations}
      />

      <TechnicalDocumentForm
        action={updateTechnicalDocumentAction.bind(null, document.id)}
        equipment={equipmentOptions}
        combinations={combinationOptions}
        document={{
          title: document.title,
          type: document.type,
          version: document.version,
          documentDate: document.documentDate
            ? document.documentDate.toISOString().slice(0, 10)
            : "",
          isPrimary: document.isPrimary,
          active: document.active,
          equipmentIds: associatedEquipment.map((item) => item.id),
          systemCombinationIds: associatedCombinations.map((item) => item.id),
        }}
        submitLabel="Enregistrer les modifications"
        readOnly={!canManage}
      />
    </>
  );
}
