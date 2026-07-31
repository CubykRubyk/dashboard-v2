import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, FileText, Power, PowerOff, Upload } from "lucide-react";
import { DeletePacDocumentButton } from "@/components/pac/DeletePacDocumentButton";
import { PacModelForm } from "@/components/pac/PacModelForm";
import { prisma } from "@/lib/prisma";
import {
  deletePacDocument,
  toggleHeatPump,
  updateHeatPump,
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
  const [model, brands, refrigerants] = await Promise.all([
    prisma.heatPump.findUnique({
      where: { id },
      include: {
        brand: true,
        refrigerant: true,
        documents: { orderBy: [{ primary: "desc" }, { createdAt: "desc" }] },
      },
    }),
    prisma.pacBrand.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.refrigerant.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  if (!model) notFound();
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
        submitLabel="Enregistrer les modifications"
      />

      <section className="card pac-documents-section">
        <div className="settings-heading">
          <div className="settings-title">
            <span className="settings-icon"><FileText size={20} /></span>
            <div><h2>Documents techniques</h2><p>Manuels, fiches techniques, schémas et codes erreur.</p></div>
          </div>
        </div>
        <form action={uploadPacDocument.bind(null, model.id)} className="pac-document-form">
          <label>Nom<input name="name" required placeholder="Ex. Manuel d’installation FR" /></label>
          <label>Type<select name="type" defaultValue="INSTALLATION_MANUAL">{Object.entries(documentLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
          <label>Version<input name="version" placeholder="Ex. 2025.1" /></label>
          <label>Date<input name="documentDate" type="date" /></label>
          <label className="pac-file-field">Fichier PDF<input name="file" type="file" accept="application/pdf,.pdf" required /></label>
          <button className="button button-primary"><Upload size={16} /> Ajouter le document</button>
        </form>
        {model.documents.length > 0 && (
          <div className="pac-document-list">
            {model.documents.map((document) => (
              <div className="pac-document-row" key={document.id}>
                <FileText size={18} />
                <span><strong>{document.name}</strong><small>{documentLabels[document.type]}{document.version ? ` · v${document.version}` : ""} · {(document.sizeBytes / 1024 / 1024).toFixed(1)} Mo</small></span>
                <Link className="mini-action" href={`/api/pac/documents/${document.id}`} target="_blank">
                  <Download size={14} /> Ouvrir
                </Link>
                <DeletePacDocumentButton action={deletePacDocument.bind(null, document.id)} name={document.name} />
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
