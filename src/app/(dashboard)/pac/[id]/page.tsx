import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Boxes, Download, FileText } from "lucide-react";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const documentLabels = {
  INSTALLATION_MANUAL: "Manuel d’installation",
  USER_MANUAL: "Manuel utilisateur",
  DATASHEET: "Fiche technique",
  WIRING_DIAGRAM: "Schéma électrique",
  ERROR_CODES: "Codes erreur",
  CERTIFICATE: "Certificat",
  OTHER: "Autre",
} as const;

export default async function PacModelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const model = await prisma.heatPump.findUnique({
    where: { id },
    include: {
      brand: true,
      refrigerant: true,
      documents: { orderBy: [{ primary: "desc" }, { createdAt: "desc" }] },
      equipmentMappings: {
        select: { equipmentId: true },
      },
      combinationMapping: {
        select: { systemCombinationId: true },
      },
    },
  });
  if (!model) notFound();
  const tco2 = model.factoryChargeKg != null && model.refrigerant
    ? model.factoryChargeKg * model.refrigerant.gwp / 1000
    : null;

  return (
    <>
      <div className="page-heading">
        <div>
          <Link className="page-back-link" href="/pac">
            <ArrowLeft size={15} /> Retour au catalogue historique
          </Link>
          <p className="eyebrow">{model.brand.name}</p>
          <h1>{model.name}</h1>
          <p>
            {model.refrigerant?.name || "Réfrigérant non renseigné"}
            {tco2 != null ? ` · ${tco2.toFixed(3)} t CO₂e` : ""}
          </p>
        </div>
        <Link href="/pac/technical" className="button button-primary">
          <Boxes size={16} /> Ouvrir la bibliothèque technique
        </Link>
      </div>

      <div className="alert alert-danger">
        Fiche historique en lecture seule. Toute modification doit être
        effectuée dans le nouveau catalogue technique.
      </div>

      <section className="card combination-identification">
        <div>
          <p className="eyebrow">Données legacy</p>
          <h2>Références conservées</h2>
        </div>
        <dl className="combination-technical-values">
          <div><dt>Statut</dt><dd>{model.active ? "Actif" : "Inactif"}</dd></div>
          <div><dt>Configuration</dt><dd>{model.configuration}</dd></div>
          <div><dt>Référence UE</dt><dd>{model.outdoorReference || "—"}</dd></div>
          <div><dt>Référence UI</dt><dd>{model.indoorReference || "—"}</dd></div>
          <div><dt>Puissance</dt><dd>{model.powerKw == null ? "—" : `${model.powerKw} kW`}</dd></div>
          <div><dt>Équipements migrés</dt><dd>{model.equipmentMappings.length}</dd></div>
          <div><dt>Combinaison migrée</dt><dd>{model.combinationMapping ? "Oui" : "Non"}</dd></div>
        </dl>
      </section>

      <section className="card pac-documents-section">
        <div className="settings-heading">
          <div className="settings-title">
            <span className="settings-icon"><FileText size={20} /></span>
            <div><h2>Documents techniques</h2><p>Manuels, fiches techniques, schémas et codes erreur.</p></div>
          </div>
        </div>
        {model.documents.length > 0 && (
          <div className="pac-document-list">
            {model.documents.map((document) => (
              <div className="pac-document-row" key={document.id}>
                <FileText size={18} />
                <span><strong>{document.name}</strong><small>{documentLabels[document.type]}{document.version ? ` · v${document.version}` : ""} · {(document.sizeBytes / 1024 / 1024).toFixed(1)} Mo</small></span>
                <Link className="mini-action" href={`/api/pac/documents/${document.id}`} target="_blank">
                  <Download size={14} /> Ouvrir
                </Link>
              </div>
            ))}
          </div>
        )}
        {model.documents.length === 0 && (
          <div className="technical-empty">Aucun document historique.</div>
        )}
      </section>
    </>
  );
}
