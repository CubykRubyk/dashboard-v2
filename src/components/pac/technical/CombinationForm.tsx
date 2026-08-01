"use client";

import { useActionState, useMemo, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  NotepadText,
  Snowflake,
  Tag,
} from "lucide-react";
import type {
  ElectricalSupply,
  EquipmentType,
  HeatPumpSplitLiaisonType,
  HeatPumpType,
} from "@/generated/prisma/enums";
import type { ActionState } from "@/lib/forms/action-state";
import { initialActionState } from "@/lib/forms/action-state";
import {
  electricalSupplyLabels,
  heatPumpTypeLabels,
  splitLiaisonTypeLabels,
} from "@/lib/hvac/labels";

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

interface EquipmentOption {
  id: string;
  manufacturerId: string;
  manufacturerReference: string;
  name: string;
  type: EquipmentType;
  active: boolean;
  referenceNeedsReview: boolean;
  productRange: { name: string } | null;
}

export interface CombinationFormValues {
  manufacturerId: string;
  productRangeId: string | null;
  name: string;
  applicationType: HeatPumpType | null;
  splitLiaisonType: HeatPumpSplitLiaisonType | null;
  electricalSupply: ElectricalSupply | null;
  nominalPowerKw: number | null;
  commissioningNotes: string;
  installationNotes: string;
  internalNotes: string;
  active: boolean;
  indoorEquipmentId: string;
  outdoorEquipmentId: string;
}

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

function equipmentOptionLabel(equipment: EquipmentOption) {
  const suffix = [
    equipment.productRange?.name,
    equipment.referenceNeedsReview ? "à vérifier" : "",
    equipment.active ? "" : "inactif",
  ].filter(Boolean).join(" · ");
  return `${equipment.manufacturerReference} — ${equipment.name}${
    suffix ? ` · ${suffix}` : ""
  }`;
}

export function CombinationForm({
  action,
  manufacturers,
  productRanges,
  equipment,
  combination,
  submitLabel,
  readOnly = false,
}: {
  action: (
    previousState: ActionState,
    formData: FormData,
  ) => Promise<ActionState>;
  manufacturers: ManufacturerOption[];
  productRanges: ProductRangeOption[];
  equipment: EquipmentOption[];
  combination?: CombinationFormValues;
  submitLabel: string;
  readOnly?: boolean;
}) {
  const firstManufacturer =
    manufacturers.find((manufacturer) => manufacturer.active)
    || manufacturers[0];
  const [manufacturerId, setManufacturerId] = useState(
    combination?.manufacturerId || firstManufacturer?.id || "",
  );
  const [productRangeId, setProductRangeId] = useState(
    combination?.productRangeId || "",
  );
  const [indoorEquipmentId, setIndoorEquipmentId] = useState(
    combination?.indoorEquipmentId || "",
  );
  const [outdoorEquipmentId, setOutdoorEquipmentId] = useState(
    combination?.outdoorEquipmentId || "",
  );
  const [state, formAction, pending] = useActionState(
    action,
    initialActionState,
  );
  const visibleRanges = useMemo(
    () => productRanges.filter(
      (range) => range.manufacturerId === manufacturerId
        && (range.active || range.id === combination?.productRangeId),
    ),
    [combination?.productRangeId, manufacturerId, productRanges],
  );
  const indoorOptions = useMemo(
    () => equipment.filter(
      (item) => item.manufacturerId === manufacturerId
        && item.type === "INDOOR_UNIT"
        && (item.active || item.id === combination?.indoorEquipmentId),
    ),
    [combination?.indoorEquipmentId, equipment, manufacturerId],
  );
  const outdoorOptions = useMemo(
    () => equipment.filter(
      (item) => item.manufacturerId === manufacturerId
        && item.type === "OUTDOOR_UNIT"
        && (item.active || item.id === combination?.outdoorEquipmentId),
    ),
    [combination?.outdoorEquipmentId, equipment, manufacturerId],
  );
  const selectedIndoor = equipment.find((item) => item.id === indoorEquipmentId);
  const selectedOutdoor = equipment.find((item) => item.id === outdoorEquipmentId);
  const generatedName = selectedIndoor && selectedOutdoor
    ? `${selectedOutdoor.manufacturerReference} + ${selectedIndoor.manufacturerReference}`
    : "RÉFÉRENCE UE + RÉFÉRENCE UI";
  const selectedInactive = [selectedIndoor, selectedOutdoor].filter(
    (item) => item && !item.active,
  );

  return (
    <form action={formAction} className="pac-model-form technical-equipment-form">
      {state.message && (
        <div
          className={`alert ${
            state.status === "success" ? "alert-success" : "alert-danger"
          }`}
          role="status"
        >
          {state.message}
        </div>
      )}

      {selectedInactive.length > 0 && (
        <div className="technical-review-alert" role="alert">
          <AlertTriangle size={19} />
          <div>
            <strong>Composant actuellement inactif</strong>
            <p>
              Il reste visible pour préserver la combinaison existante.
              Sélectionnez un composant actif si vous souhaitez le remplacer.
            </p>
          </div>
        </div>
      )}

      <section className="card pac-form-section">
        <SectionHeading icon={Tag} eyebrow="Identification" title="Combinaison split" />
        <div className="pac-form-grid technical-form-grid">
          <label>
            Fabricant
            <select
              name="manufacturerId"
              required
              value={manufacturerId}
              disabled={readOnly}
              onChange={(event) => {
                setManufacturerId(event.currentTarget.value);
                setProductRangeId("");
                setIndoorEquipmentId("");
                setOutdoorEquipmentId("");
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
            Gamme de la combinaison
            <select
              name="productRangeId"
              value={productRangeId}
              disabled={readOnly}
              onChange={(event) => setProductRangeId(event.currentTarget.value)}
            >
              <option value="">Sans gamme</option>
              {visibleRanges.map((range) => (
                <option value={range.id} key={range.id}>
                  {range.name}{range.active ? "" : " · inactive"}
                </option>
              ))}
            </select>
          </label>
          <label>
            Statut
            <select
              name="active"
              defaultValue={String(combination?.active ?? true)}
              disabled={readOnly}
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </label>
          <label className="technical-reference-field">
            Nom
            <input
              name="name"
              defaultValue={combination?.name}
              placeholder={generatedName}
              disabled={readOnly}
            />
            <small>
              Facultatif. Sans nom, la référence UE + la référence UI sera utilisée.
            </small>
          </label>
        </div>
      </section>

      <section className="card pac-form-section">
        <SectionHeading icon={Boxes} eyebrow="Composants" title="Unités compatibles" />
        <div className="pac-form-grid technical-form-grid combination-component-grid">
          <label>
            Unité extérieure
            <select
              name="outdoorEquipmentId"
              required
              value={outdoorEquipmentId}
              disabled={readOnly}
              onChange={(event) => setOutdoorEquipmentId(event.currentTarget.value)}
            >
              <option value="">Sélectionner une UE…</option>
              {outdoorOptions.map((item) => (
                <option value={item.id} key={item.id}>
                  {equipmentOptionLabel(item)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Unité intérieure
            <select
              name="indoorEquipmentId"
              required
              value={indoorEquipmentId}
              disabled={readOnly}
              onChange={(event) => setIndoorEquipmentId(event.currentTarget.value)}
            >
              <option value="">Sélectionner une UI…</option>
              {indoorOptions.map((item) => (
                <option value={item.id} key={item.id}>
                  {equipmentOptionLabel(item)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="technical-form-help">
          Les deux unités doivent appartenir au fabricant sélectionné. Elles peuvent
          provenir de gammes différentes.
        </p>
      </section>

      <section className="card pac-form-section">
        <SectionHeading icon={Snowflake} eyebrow="Configuration" title="Caractéristiques du système" />
        <div className="pac-form-grid technical-form-grid">
          <label>
            Application
            <select
              name="applicationType"
              defaultValue={combination?.applicationType || ""}
              disabled={readOnly}
            >
              <option value="">Non renseignée</option>
              {Object.entries(heatPumpTypeLabels).map(([value, label]) => (
                <option value={value} key={value}>{label}</option>
              ))}
            </select>
          </label>
          <label>
            Type de liaison
            <select
              name="splitLiaisonType"
              defaultValue={combination?.splitLiaisonType || ""}
              disabled={readOnly}
            >
              <option value="">Non renseigné</option>
              {Object.entries(splitLiaisonTypeLabels).map(([value, label]) => (
                <option value={value} key={value}>{label}</option>
              ))}
            </select>
          </label>
          <label>
            Alimentation
            <select
              name="electricalSupply"
              defaultValue={combination?.electricalSupply || ""}
              disabled={readOnly}
            >
              <option value="">Non renseignée</option>
              {Object.entries(electricalSupplyLabels).map(([value, label]) => (
                <option value={value} key={value}>{label}</option>
              ))}
            </select>
          </label>
          <label>
            Puissance nominale
            <span className="technical-unit-input">
              <input
                name="nominalPowerKw"
                type="number"
                min="0"
                step="0.1"
                defaultValue={combination?.nominalPowerKw ?? ""}
                disabled={readOnly}
              />
              <span>kW</span>
            </span>
          </label>
        </div>
      </section>

      <section className="card pac-form-section">
        <SectionHeading icon={NotepadText} eyebrow="Observations" title="Notes techniques" />
        <div className="pac-form-grid technical-form-grid">
          <label>
            Mise en service
            <textarea
              name="commissioningNotes"
              rows={5}
              defaultValue={combination?.commissioningNotes}
              disabled={readOnly}
            />
          </label>
          <label>
            Installation
            <textarea
              name="installationNotes"
              rows={5}
              defaultValue={combination?.installationNotes}
              disabled={readOnly}
            />
          </label>
          <label>
            Notes internes
            <textarea
              name="internalNotes"
              rows={5}
              defaultValue={combination?.internalNotes}
              disabled={readOnly}
            />
          </label>
        </div>
      </section>

      {!readOnly && (
        <div className="pac-form-actions">
          <button className="button button-primary" disabled={pending}>
            {pending ? "Enregistrement…" : submitLabel}
          </button>
        </div>
      )}
    </form>
  );
}
