"use client";

import { useActionState, useMemo, useState } from "react";
import { FileText, Gauge, NotepadText, Tag } from "lucide-react";

import type { ActionState } from "@/lib/forms/action-state";
import { initialActionState } from "@/lib/forms/action-state";
import type { PumpConfiguration } from "@/lib/hvac/simple-pump-validation";

interface ManufacturerOption {
  id: string;
  name: string;
  active: boolean;
}

interface ProductRangeOption {
  id: string;
  manufacturerId: string;
  name: string;
  active: boolean;
}

interface DocumentOption {
  id: string;
  title: string;
}

const NEW_RANGE = "__new__";

const configurations: { value: PumpConfiguration; label: string; hint: string }[] = [
  {
    value: "MONOBLOC",
    label: "Monobloc",
    hint: "Une seule fiche est créée.",
  },
  {
    value: "SPLIT",
    label: "Split (intérieur + extérieur)",
    hint: "Une fiche par référence saisie ci-dessous.",
  },
  {
    value: "UNKNOWN",
    label: "Je ne sais pas encore",
    hint: "Une fiche unique, à préciser plus tard.",
  },
];

function SectionHeading({
  icon: Icon,
  eyebrow,
  title,
}: {
  icon: React.ComponentType<{ size?: number }>;
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="pac-form-heading technical-form-heading">
      <span><Icon size={18} /></span>
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
    </div>
  );
}

export function SimplePumpForm({
  action,
  manufacturers,
  productRanges,
  documents,
}: {
  action: (previousState: ActionState, formData: FormData) => Promise<ActionState>;
  manufacturers: ManufacturerOption[];
  productRanges: ProductRangeOption[];
  documents: DocumentOption[];
}) {
  const firstManufacturer = manufacturers.find((item) => item.active) || manufacturers[0];
  const [manufacturerId, setManufacturerId] = useState(firstManufacturer?.id || "");
  const [rangeChoice, setRangeChoice] = useState("");
  const [configuration, setConfiguration] = useState<PumpConfiguration>("MONOBLOC");
  const [state, formAction, pending] = useActionState(action, initialActionState);

  const visibleRanges = useMemo(
    () => productRanges.filter((range) => range.manufacturerId === manufacturerId),
    [manufacturerId, productRanges],
  );

  const referenceHint =
    configuration === "MONOBLOC"
      ? "Facultatif. Sans référence, le nom de la pompe est utilisé et la fiche est signalée « à vérifier »."
      : "Facultatives. Une fiche est créée pour chaque référence saisie ; aucune ne l’est si vous les laissez vides.";

  return (
    <form action={formAction} className="pac-model-form technical-equipment-form">
      {state.message && (
        <div
          className={`alert ${state.status === "success" ? "alert-success" : "alert-danger"}`}
          role="status"
        >
          {state.message}
        </div>
      )}

      <section className="card pac-form-section">
        <SectionHeading icon={Tag} eyebrow="Identification" title="La pompe" />
        <div className="pac-form-grid technical-form-grid">
          <label>
            Fabricant
            <select
              name="manufacturerId"
              required
              value={manufacturerId}
              onChange={(event) => {
                setManufacturerId(event.currentTarget.value);
                setRangeChoice("");
              }}
            >
              <option value="">Sélectionner…</option>
              {manufacturers.map((manufacturer) => (
                <option value={manufacturer.id} key={manufacturer.id}>
                  {manufacturer.name}{manufacturer.active ? "" : " · inactif"}
                </option>
              ))}
            </select>
          </label>

          <label>
            Gamme
            <select
              value={rangeChoice}
              disabled={!manufacturerId}
              onChange={(event) => setRangeChoice(event.currentTarget.value)}
            >
              <option value="">Sans gamme</option>
              {visibleRanges.map((range) => (
                <option value={range.id} key={range.id}>
                  {range.name}{range.active ? "" : " · inactive"}
                </option>
              ))}
              <option value={NEW_RANGE}>+ Nouvelle gamme…</option>
            </select>
            <small>Facultative.</small>
          </label>

          {/* Le `select` ci-dessus n'est pas soumis : il pilote lequel des deux champs cachés
              porte la valeur, pour que le serveur reçoive soit un id, soit un nom, jamais les deux. */}
          <input
            type="hidden"
            name="productRangeId"
            value={rangeChoice === NEW_RANGE ? "" : rangeChoice}
          />

          {rangeChoice === NEW_RANGE && (
            <label>
              Nom de la nouvelle gamme
              <input
                name="newProductRangeName"
                required
                maxLength={120}
                placeholder="Ex. Altherma 3"
              />
              <small>Elle sera créée pour ce fabricant.</small>
            </label>
          )}

          <label>
            Nom de la pompe
            <input
              name="name"
              required
              maxLength={160}
              placeholder="Ex. Altherma 3 H HT 16 kW"
            />
          </label>

          <label>
            Configuration
            <select
              name="configuration"
              required
              value={configuration}
              onChange={(event) =>
                setConfiguration(event.currentTarget.value as PumpConfiguration)}
            >
              {configurations.map((option) => (
                <option value={option.value} key={option.value}>{option.label}</option>
              ))}
            </select>
            <small>
              {configurations.find((option) => option.value === configuration)?.hint}
            </small>
          </label>
        </div>
      </section>

      <section className="card pac-form-section">
        <SectionHeading
          icon={Gauge}
          eyebrow="Références"
          title={configuration === "MONOBLOC" ? "Référence fabricant" : "Groupes intérieur / extérieur"}
        />
        <div className="pac-form-grid technical-form-grid">
          {configuration === "MONOBLOC" ? (
            <label>
              Référence fabricant
              <input name="indoorReference" maxLength={160} placeholder="Ex. EBLA 16 D3V3" />
              <small>{referenceHint}</small>
            </label>
          ) : (
            <>
              <label>
                Référence du groupe intérieur
                <input name="indoorReference" maxLength={160} placeholder="Ex. EHVH 16 S26E9W" />
              </label>
              <label>
                Référence du groupe extérieur
                <input name="outdoorReference" maxLength={160} placeholder="Ex. EPRA 16 DW17" />
                <small>{referenceHint}</small>
              </label>
            </>
          )}
          <label>
            Puissance nominale
            <span className="technical-unit-input">
              <input name="nominalPowerKw" inputMode="decimal" placeholder="16" />
              <span>kW</span>
            </span>
          </label>
        </div>
      </section>

      <section className="card pac-form-section">
        <SectionHeading icon={FileText} eyebrow="Documentation" title="Manuel" />
        <div className="pac-form-grid technical-form-grid">
          <label>
            Importer un manuel (PDF)
            <input type="file" name="manualFile" accept="application/pdf,.pdf" />
            <small>Facultatif. Il sera associé automatiquement à la pompe créée.</small>
          </label>
          {documents.length > 0 && (
            <label>
              …ou associer des documents existants
              <select name="existingDocumentIds" multiple size={Math.min(6, documents.length)}>
                {documents.map((document) => (
                  <option value={document.id} key={document.id}>{document.title}</option>
                ))}
              </select>
              <small>Maintenez ⌘ (ou Ctrl) pour en sélectionner plusieurs.</small>
            </label>
          )}
        </div>
      </section>

      <section className="card pac-form-section">
        <SectionHeading icon={NotepadText} eyebrow="Observations" title="Notes" />
        <div className="pac-form-grid technical-form-grid technical-form-grid-wide">
          <label>
            Notes d’installation
            <textarea name="installationNotes" rows={4} />
          </label>
          <label>
            Notes internes
            <textarea name="internalNotes" rows={3} />
          </label>
        </div>
      </section>

      <div className="pac-form-actions">
        <button className="button button-primary" disabled={pending}>
          {pending ? "Création…" : "Créer la pompe"}
        </button>
      </div>
    </form>
  );
}
