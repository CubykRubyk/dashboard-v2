"use client";

import { useActionState, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bolt,
  Cable,
  ChartNoAxesCombined,
  Droplets,
  Gauge,
  NotepadText,
  Snowflake,
  Tag,
} from "lucide-react";
import type {
  ElectricalSupply,
  EquipmentType,
} from "@/generated/prisma/enums";
import { EquipmentType as EquipmentTypeValues } from "@/generated/prisma/enums";
import type { ActionState } from "@/lib/forms/action-state";
import { initialActionState } from "@/lib/forms/action-state";
import {
  electricalSupplyLabels,
  equipmentTypeLabels,
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

interface RefrigerantOption {
  id: string;
  name: string;
  gwp: number;
  active: boolean;
}

export interface EquipmentFormValues {
  manufacturerId: string;
  productRangeId: string | null;
  type: EquipmentType;
  name: string;
  manufacturerReference: string;
  referenceNeedsReview: boolean;
  electricalSupply: ElectricalSupply | null;
  recommendedProtection: string;
  powerCable: string;
  communicationCable: string;
  refrigerantId: string | null;
  factoryChargeKg: number | null;
  maxPipeLengthM: number | null;
  maxHeightDifferenceM: number | null;
  includedPipeLengthM: number | null;
  additionalChargeGPerM: number | null;
  liquidPipeDiameter: string;
  gasPipeDiameter: string;
  hydraulicConnections: string;
  minimumFlow: string;
  minimumWaterVolume: string;
  maximumFlowTemperature: string;
  bufferTankRecommendation: string;
  nominalPowerKw: number | null;
  commissioningNotes: string;
  installationNotes: string;
  internalNotes: string;
}

function UnitField({
  label,
  name,
  unit,
  defaultValue,
  step = "any",
  disabled,
}: {
  label: string;
  name: string;
  unit: string;
  defaultValue?: number | null;
  step?: string;
  disabled?: boolean;
}) {
  return (
    <label>
      {label}
      <span className="technical-unit-input">
        <input
          name={name}
          type="number"
          min="0"
          step={step}
          defaultValue={defaultValue ?? ""}
          disabled={disabled}
        />
        <span>{unit}</span>
      </span>
    </label>
  );
}

function TextUnitField({
  label,
  name,
  unit,
  defaultValue,
  placeholder,
  disabled,
}: {
  label: string;
  name: string;
  unit: string;
  defaultValue?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <label>
      {label}
      <span className="technical-unit-input">
        <input
          name={name}
          defaultValue={defaultValue}
          placeholder={placeholder}
          disabled={disabled}
        />
        <span>{unit}</span>
      </span>
    </label>
  );
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

export function EquipmentForm({
  action,
  manufacturers,
  productRanges,
  refrigerants,
  equipment,
  submitLabel,
  readOnly = false,
}: {
  action: (
    previousState: ActionState,
    formData: FormData,
  ) => Promise<ActionState>;
  manufacturers: ManufacturerOption[];
  productRanges: ProductRangeOption[];
  refrigerants: RefrigerantOption[];
  equipment?: EquipmentFormValues;
  submitLabel: string;
  readOnly?: boolean;
}) {
  const firstManufacturer =
    manufacturers.find((manufacturer) => manufacturer.active)
    || manufacturers[0];
  const [manufacturerId, setManufacturerId] = useState(
    equipment?.manufacturerId || firstManufacturer?.id || "",
  );
  const [productRangeId, setProductRangeId] = useState(
    equipment?.productRangeId || "",
  );
  const [state, formAction, pending] = useActionState(
    action,
    initialActionState,
  );
  const visibleRanges = useMemo(
    () => productRanges.filter(
      (productRange) => productRange.manufacturerId === manufacturerId,
    ),
    [manufacturerId, productRanges],
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

      {equipment?.referenceNeedsReview && (
        <div className="technical-review-alert" role="alert">
          <AlertTriangle size={19} />
          <div>
            <strong>Référence legacy à vérifier</strong>
            <p>
              Remplacez la référence provisoire par la référence fabricant.
              Le signalement disparaîtra automatiquement après correction.
            </p>
          </div>
        </div>
      )}

      <section className="card pac-form-section">
        <SectionHeading icon={Tag} eyebrow="Identification" title="Référence physique" />
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
              name="productRangeId"
              value={productRangeId}
              disabled={readOnly || !manufacturerId}
              onChange={(event) => setProductRangeId(event.currentTarget.value)}
            >
              <option value="">Sans gamme</option>
              {visibleRanges.map((productRange) => (
                <option value={productRange.id} key={productRange.id}>
                  {productRange.name}{productRange.active ? "" : " · inactive"}
                </option>
              ))}
            </select>
          </label>
          <label>
            Type d’équipement
            <select
              name="type"
              required
              defaultValue={equipment?.type || EquipmentTypeValues.OTHER}
              disabled={readOnly}
            >
              {Object.values(EquipmentTypeValues).map((type) => (
                <option value={type} key={type}>{equipmentTypeLabels[type]}</option>
              ))}
            </select>
          </label>
          <label>
            Désignation
            <input
              name="name"
              required
              maxLength={160}
              defaultValue={equipment?.name}
              placeholder="Ex. Unité extérieure Altherma 3"
              disabled={readOnly}
            />
          </label>
          <label className="technical-reference-field">
            Référence fabricant
            <input
              name="manufacturerReference"
              required
              maxLength={160}
              defaultValue={equipment?.manufacturerReference}
              placeholder="Ex. EPRA 16 DW17"
              disabled={readOnly}
            />
            <small>Les espaces et la casse sont ignorés pour détecter les doublons.</small>
          </label>
        </div>
      </section>

      <section className="card pac-form-section">
        <SectionHeading icon={Bolt} eyebrow="Électrique" title="Alimentation, protections et câbles" />
        <div className="pac-form-grid technical-form-grid">
          <label>
            Alimentation
            <select
              name="electricalSupply"
              defaultValue={equipment?.electricalSupply || ""}
              disabled={readOnly}
            >
              <option value="">Non renseignée</option>
              {Object.entries(electricalSupplyLabels).map(([value, label]) => (
                <option value={value} key={value}>{label}</option>
              ))}
            </select>
          </label>
          <TextUnitField
            label="Protection recommandée"
            name="recommendedProtection"
            unit="A"
            defaultValue={equipment?.recommendedProtection}
            placeholder="Ex. C32"
            disabled={readOnly}
          />
          <TextUnitField
            label="Câble d’alimentation"
            name="powerCable"
            unit="mm²"
            defaultValue={equipment?.powerCable}
            placeholder="Ex. 3G6"
            disabled={readOnly}
          />
          <label>
            Câble de communication
            <input
              name="communicationCable"
              defaultValue={equipment?.communicationCable}
              placeholder="Ex. 2 x 0,75 mm²"
              disabled={readOnly}
            />
          </label>
        </div>
      </section>

      <section className="card pac-form-section">
        <SectionHeading icon={Snowflake} eyebrow="Frigorifique" title="Réfrigérant et charge" />
        <div className="pac-form-grid technical-form-grid">
          <label>
            Réfrigérant
            <select
              name="refrigerantId"
              defaultValue={equipment?.refrigerantId || ""}
              disabled={readOnly}
            >
              <option value="">Non renseigné</option>
              {refrigerants.map((refrigerant) => (
                <option value={refrigerant.id} key={refrigerant.id}>
                  {refrigerant.name} · GWP {refrigerant.gwp}
                  {refrigerant.active ? "" : " · inactif"}
                </option>
              ))}
            </select>
          </label>
          <UnitField
            label="Charge usine"
            name="factoryChargeKg"
            unit="kg"
            step="0.001"
            defaultValue={equipment?.factoryChargeKg}
            disabled={readOnly}
          />
          {equipment?.factoryChargeKg != null && equipment.refrigerantId && (
            <div className="technical-derived-value">
              <small>Équivalent CO₂</small>
              <strong>
                {(
                  equipment.factoryChargeKg
                  * (refrigerants.find((item) => item.id === equipment.refrigerantId)?.gwp || 0)
                  / 1000
                ).toFixed(3)} t CO₂eq
              </strong>
            </div>
          )}
        </div>
      </section>

      <section className="card pac-form-section">
        <SectionHeading icon={Cable} eyebrow="Liaison frigorifique" title="Diamètres, longueurs et charge additionnelle" />
        <div className="pac-form-grid technical-form-grid">
          <label>
            Diamètre liquide
            <input
              name="liquidPipeDiameter"
              defaultValue={equipment?.liquidPipeDiameter}
              placeholder="Ex. 1/4″ ou 6,35 mm"
              disabled={readOnly}
            />
          </label>
          <label>
            Diamètre gaz
            <input
              name="gasPipeDiameter"
              defaultValue={equipment?.gasPipeDiameter}
              placeholder="Ex. 5/8″ ou 15,88 mm"
              disabled={readOnly}
            />
          </label>
          <UnitField label="Longueur maximale" name="maxPipeLengthM" unit="m" step="0.1" defaultValue={equipment?.maxPipeLengthM} disabled={readOnly} />
          <UnitField label="Dénivelé maximal" name="maxHeightDifferenceM" unit="m" step="0.1" defaultValue={equipment?.maxHeightDifferenceM} disabled={readOnly} />
          <UnitField label="Longueur incluse" name="includedPipeLengthM" unit="m" step="0.1" defaultValue={equipment?.includedPipeLengthM} disabled={readOnly} />
          <UnitField label="Charge supplémentaire" name="additionalChargeGPerM" unit="g/m" step="0.1" defaultValue={equipment?.additionalChargeGPerM} disabled={readOnly} />
        </div>
      </section>

      <section className="card pac-form-section">
        <SectionHeading icon={Droplets} eyebrow="Hydraulique" title="Raccordements et limites hydrauliques" />
        <div className="pac-form-grid technical-form-grid">
          <label>
            Raccordements hydrauliques
            <input
              name="hydraulicConnections"
              defaultValue={equipment?.hydraulicConnections}
              placeholder="Ex. 1″ mâle"
              disabled={readOnly}
            />
          </label>
          <TextUnitField label="Débit minimal" name="minimumFlow" unit="l/min" defaultValue={equipment?.minimumFlow} disabled={readOnly} />
          <TextUnitField label="Volume d’eau minimal" name="minimumWaterVolume" unit="l" defaultValue={equipment?.minimumWaterVolume} disabled={readOnly} />
          <TextUnitField label="Température départ maximale" name="maximumFlowTemperature" unit="°C" defaultValue={equipment?.maximumFlowTemperature} disabled={readOnly} />
          <TextUnitField label="Volume tampon recommandé" name="bufferTankRecommendation" unit="l" defaultValue={equipment?.bufferTankRecommendation} disabled={readOnly} />
        </div>
      </section>

      <section className="card pac-form-section">
        <SectionHeading icon={ChartNoAxesCombined} eyebrow="Performance" title="Performance de base" />
        <div className="pac-form-grid technical-form-grid">
          <UnitField
            label="Puissance nominale"
            name="nominalPowerKw"
            unit="kW"
            step="0.1"
            defaultValue={equipment?.nominalPowerKw}
            disabled={readOnly}
          />
          <div className="pac-form-note">
            Ne renseignez que les valeurs confirmées par la documentation fabricant.
          </div>
        </div>
      </section>

      <section className="card pac-form-section">
        <SectionHeading icon={NotepadText} eyebrow="Observations" title="Procédures et connaissances internes" />
        <div className="pac-notes-grid">
          <label>
            Mise en service
            <textarea name="commissioningNotes" rows={5} defaultValue={equipment?.commissioningNotes} disabled={readOnly} />
          </label>
          <label>
            Notes d’installation
            <textarea name="installationNotes" rows={5} defaultValue={equipment?.installationNotes} disabled={readOnly} />
          </label>
          <label>
            Notes internes
            <textarea name="internalNotes" rows={4} defaultValue={equipment?.internalNotes} disabled={readOnly} />
          </label>
        </div>
      </section>

      {!readOnly && (
        <div className="pac-form-actions">
          <button className="button button-primary" disabled={pending}>
            <Gauge size={17} />
            {pending ? "Enregistrement…" : submitLabel}
          </button>
        </div>
      )}
    </form>
  );
}
