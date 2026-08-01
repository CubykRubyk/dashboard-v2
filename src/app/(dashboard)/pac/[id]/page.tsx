import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, FileText, Power, PowerOff, Save, Share2, Upload } from "lucide-react";
import { DeletePacDocumentButton } from "@/components/pac/DeletePacDocumentButton";
import { PacModelForm } from "@/components/pac/PacModelForm";
import { prisma } from "@/lib/prisma";
import {
  deletePacDocument,
  toggleHeatPump,
  updateHeatPump,
  updatePacDocumentAssignments,
  uploadPacDocument,
} from "../actions";

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
    include: { brand: true, refrigerant: true, range: true },
  });
  if (!model) notFound();

  const [brands, refrigerants, ranges, brandModels, documents] = await Promise.all([
    prisma.pacBrand.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.refrigerant.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.pacRange.findMany({
      where: { brandId: model.brandId },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    }),
    prisma.heatPump.findMany({
      where: { brandId: model.brandId },
      select: { id: true, name: true, active: true, rangeId: true },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    }),
    prisma.pacDocument.findMany({
      where: {
        OR: [
          { modelLinks: { some: { heatPumpId: model.id } } },
          ...(model.rangeId ? [{ rangeId: model.rangeId }] : []),
        ],
      },
      include: {
        range: { include: { models: { select: { id: true, name: true } } } },
        modelLinks: {
          include: { heatPump: { select: { id: true, name: true } } },
          orderBy: { heatPump: { name: "asc" } },
        },
      },
      orderBy: [{ primary: "desc" }, { createdAt: "desc" }],
    }),
  ]);
  const tco2 = model.factoryChargeKg != null && model.refrigerant
    ? model.factoryChargeKg * model.refrigerant.gwp / 1000
    : null;

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{model.brand.name}</p>
          <h1>{model.name}</h1>
          <p>
            {model.refrigerant?.name || "Réfrigérant non renseigné"}
            {tco2 != null ? ` · ${tco2.toFixed(3)} t CO₂e` : ""}
          </p>
        </div>
        <form action={toggleHeatPump.bind(null, model.id, !model.active)}>
          <button className={`button ${model.active ? "button-ghost" : "button-primary"}`}>
            {model.active ? <><PowerOff size={16} /> Désactiver</> : <><Power size={16} /> Activer</>}
          </button>
        </form>
      </div>

      <PacModelForm
        action={updateHeatPump.bind(null, model.id)}
        brands={brands.some((brand) => brand.id === model.brandId) ? brands : [model.brand, ...brands]}
        refrigerants={
          model.refrigerant && !refrigerants.some((item) => item.id === model.refrigerantId)
            ? [model.refrigerant, ...refrigerants]
            : refrigerants
        }
        model={model}
        ranges={
          model.range && !ranges.some((range) => range.id === model.rangeId)
            ? [model.range, ...ranges]
            : ranges
        }
        submitLabel="Enregistrer les modifications"
      />

      <section className="card pac-documents-section">
        <div className="settings-heading">
          <div className="settings-title">
            <span className="settings-icon"><FileText size={20} /></span>
            <div><h2>Bibliothèque technique</h2><p>Chargez le PDF une fois, puis attribuez-le à une gamme ou à plusieurs modèles.</p></div>
          </div>
        </div>
        <form action={uploadPacDocument.bind(null, model.id)} className="pac-document-form">
          <div className="pac-document-metadata">
            <label>Nom<input name="name" required placeholder="Ex. Manuel d’installation FR" /></label>
            <label>Type<select name="type" defaultValue="INSTALLATION_MANUAL">{Object.entries(documentLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
            <label>Langue<input name="language" defaultValue="FR" maxLength={10} /></label>
            <label>Version<input name="version" placeholder="Ex. 2025.1" /></label>
            <label>Date<input name="documentDate" type="date" /></label>
            <label className="pac-file-field">Fichier PDF<input name="file" type="file" accept="application/pdf,.pdf" required /></label>
          </div>
          <fieldset className="pac-document-scope">
            <legend>Attribution du document</legend>
            <label className="pac-document-range">
              Gamme complète
              <select name="rangeId" defaultValue="">
                <option value="">Aucune gamme complète</option>
                {ranges.map((range) => (
                  <option value={range.id} key={range.id}>
                    {range.name}{range.active ? "" : " (inactive)"}
                  </option>
                ))}
              </select>
            </label>
            <div className="pac-document-model-options">
              {brandModels.map((item) => (
                <label className="pac-document-checkbox" key={item.id}>
                  <input name="modelIds" type="checkbox" value={item.id} defaultChecked={item.id === model.id} />
                  <span>{item.name}{item.active ? "" : " (inactif)"}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="pac-document-submit">
            <span>Marque concernée : <strong>{model.brand.name}</strong></span>
            <button className="button button-primary"><Upload size={16} /> Ajouter le document</button>
          </div>
        </form>
        {documents.length > 0 ? (
          <div className="pac-document-list">
            {documents.map((document) => {
              const directModelIds = new Set(document.modelLinks.map((link) => link.heatPumpId));
              const assignedModelIds = new Set([
                ...directModelIds,
                ...(document.range?.models.map((item) => item.id) || []),
              ]);
              const inherited = document.rangeId === model.rangeId && !directModelIds.has(model.id);
              return (
                <div className="pac-document-row" key={document.id}>
                  <FileText size={18} />
                  <span>
                    <strong>{document.name}</strong>
                    <small>
                      {documentLabels[document.type]}
                      {document.language ? ` · ${document.language}` : ""}
                      {document.version ? ` · v${document.version}` : ""}
                      {` · ${(document.sizeBytes / 1024 / 1024).toFixed(1)} Mo`}
                    </small>
                    <small className="pac-document-coverage">
                      {document.range ? `Gamme ${document.range.name}` : "Modèles sélectionnés"}
                      {` · ${assignedModelIds.size} modèle${assignedModelIds.size === 1 ? "" : "s"}`}
                      {inherited ? " · hérité de la gamme" : ""}
                    </small>
                  </span>
                  <details className="pac-document-assignment-details">
                    <summary className="mini-action"><Share2 size={14} /> Affectations</summary>
                    <form
                      action={updatePacDocumentAssignments.bind(null, document.id, model.id)}
                      className="pac-document-assignment-panel"
                    >
                      <label>
                        Gamme complète
                        <select name="rangeId" defaultValue={document.rangeId || ""}>
                          <option value="">Aucune gamme complète</option>
                          {ranges.map((range) => (
                            <option value={range.id} key={range.id}>
                              {range.name}{range.active ? "" : " (inactive)"}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="pac-document-model-options">
                        {brandModels.map((item) => (
                          <label className="pac-document-checkbox" key={item.id}>
                            <input name="modelIds" type="checkbox" value={item.id} defaultChecked={directModelIds.has(item.id)} />
                            <span>{item.name}{item.active ? "" : " (inactif)"}</span>
                          </label>
                        ))}
                      </div>
                      <button className="button button-primary button-small"><Save size={14} /> Enregistrer</button>
                    </form>
                  </details>
                  <Link className="mini-action" href={`/api/pac/documents/${document.id}`} target="_blank">
                    <Download size={14} /> Ouvrir
                  </Link>
                  <DeletePacDocumentButton
                    action={deletePacDocument.bind(null, document.id)}
                    assignmentCount={assignedModelIds.size}
                    name={document.name}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="pac-document-empty">Aucun document attribué à ce modèle ou à sa gamme.</div>
        )}
      </section>
    </>
  );
}
