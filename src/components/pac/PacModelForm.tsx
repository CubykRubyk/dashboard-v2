"use client";

import { useState } from "react";
import type { HeatPump } from "@/generated/prisma/client";
import { HeatPumpConfiguration, type HeatPumpSplitLiaisonType } from "@/generated/prisma/enums";

type Option = { id: string; name: string };
type RefrigerantOption = Option & { gwp: number };
type RangeOption = Option & { brandId: string };

const splitLiaisonLabels: Record<HeatPumpSplitLiaisonType, string> = {
  FRIGORIFIC: "Split avec liaison frigorifique",
  HYDRAULIC: "Split avec liaison hydraulique",
};

export function PacModelForm({
  action,
  brands,
  ranges,
  refrigerants,
  model,
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  brands: Option[];
  ranges: RangeOption[];
  refrigerants: RefrigerantOption[];
  model?: HeatPump;
  submitLabel: string;
}) {
  const [configuration, setConfiguration] = useState(model?.configuration || HeatPumpConfiguration.SPLIT);
  const [splitLiaisonType, setSplitLiaisonType] = useState<HeatPumpSplitLiaisonType>(model?.splitLiaisonType || "FRIGORIFIC");
  const [brandId, setBrandId] = useState(model?.brandId || brands[0]?.id || "");
  const [rangeId, setRangeId] = useState(model?.rangeId || "");

  const isSplit = configuration === HeatPumpConfiguration.SPLIT;
  const usesFrigorificLiaison = isSplit && splitLiaisonType === "FRIGORIFIC";
  const indoorPowerValue = model?.indoorPowerCable || model?.powerCable || "";
  const availableRanges = ranges.filter((range) => range.brandId === brandId);

  return (
    <form action={action} className="pac-model-form">
      <section className="card pac-form-section">
        <div className="pac-form-heading"><p className="eyebrow">Identification</p><h2>Modèle et références</h2></div>
        <div className="pac-form-grid">
          <label>
            Marque
            <select
              name="brandId"
              required
              value={brandId}
              onChange={(event) => {
                setBrandId(event.currentTarget.value);
                setRangeId("");
              }}
            >
              {brands.map((brand) => <option value={brand.id} key={brand.id}>{brand.name}</option>)}
            </select>
          </label>
          <label>
            Gamme
            <select name="rangeId" value={rangeId} onChange={(event) => setRangeId(event.currentTarget.value)}>
              <option value="">Sans gamme</option>
              {availableRanges.map((range) => <option value={range.id} key={range.id}>{range.name}</option>)}
            </select>
          </label>
          <label>Nom du modèle<input name="name" required defaultValue={model?.name} placeholder="Ex. Altherma 3 R F" /></label>
          <label>Type<select name="type" defaultValue={model?.type || "AIR_WATER"}><option value="AIR_WATER">Air / eau</option><option value="AIR_AIR">Air / air</option><option value="GROUND_WATER">Sol / eau</option></select></label>
          <label>
            Configuration
            <select
              name="configuration"
              defaultValue={model?.configuration || HeatPumpConfiguration.SPLIT}
              onChange={(event) => setConfiguration(event.currentTarget.value as typeof HeatPumpConfiguration[keyof typeof HeatPumpConfiguration])}
            >
              <option value={HeatPumpConfiguration.SPLIT}>Split</option>
              <option value={HeatPumpConfiguration.MONOBLOC}>Monobloc</option>
            </select>
          </label>
          <label>Alimentation électrique<select name="electricalSupply" defaultValue={model?.electricalSupply || "SINGLE_PHASE"}><option value="SINGLE_PHASE">Monophasé</option><option value="THREE_PHASE">Triphasé</option></select></label>
          <label>Puissance nominale (kW)<input name="powerKw" type="number" min="0" step="0.1" defaultValue={model?.powerKw ?? ""} /></label>
          {isSplit ? (
            <label>
              Type de liaison
              <select
                name="splitLiaisonType"
                value={splitLiaisonType}
                onChange={(event) => setSplitLiaisonType(event.currentTarget.value as HeatPumpSplitLiaisonType)}
              >
                {Object.entries(splitLiaisonLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
              </select>
            </label>
          ) : (
            <input type="hidden" name="splitLiaisonType" value="" />
          )}
          <label>Référence unité extérieure<input name="outdoorReference" defaultValue={model?.outdoorReference} /></label>
          <label>Référence unité intérieure<input name="indoorReference" defaultValue={model?.indoorReference} /></label>
        </div>
      </section>

      <section className="card pac-form-section">
        <div className="pac-form-heading"><p className="eyebrow">Circuit frigorifique</p><h2>Réfrigérant et liaisons</h2></div>
        <div className="pac-form-grid">
          <label>Réfrigérant<select name="refrigerantId" defaultValue={model?.refrigerantId || ""}><option value="">Non renseigné</option>{refrigerants.map((item) => <option value={item.id} key={item.id}>{item.name} · GWP {item.gwp}</option>)}</select></label>
          <label>Charge usine (kg)<input name="factoryChargeKg" type="number" min="0" step="0.001" defaultValue={model?.factoryChargeKg ?? ""} /></label>
          {usesFrigorificLiaison ? (
            <>
              <label>Longueur maximale (m)<input name="maxPipeLengthM" type="number" min="0" step="0.1" defaultValue={model?.maxPipeLengthM ?? ""} /></label>
              <label>Dénivelé maximal (m)<input name="maxHeightDifferenceM" type="number" min="0" step="0.1" defaultValue={model?.maxHeightDifferenceM ?? ""} /></label>
              <label>Longueur incluse (m)<input name="includedPipeLengthM" type="number" min="0" step="0.1" defaultValue={model?.includedPipeLengthM ?? ""} /></label>
              <label>Charge supplémentaire (g/m)<input name="additionalChargeGPerM" type="number" min="0" step="0.1" defaultValue={model?.additionalChargeGPerM ?? ""} /></label>
              <label>Diamètre liquide<input name="liquidPipeDiameter" defaultValue={model?.liquidPipeDiameter} placeholder="Ex. 1/4&quot;" /></label>
              <label>Diamètre gaz<input name="gasPipeDiameter" defaultValue={model?.gasPipeDiameter} placeholder="Ex. 5/8&quot;" /></label>
            </>
          ) : (
            <>
              <input type="hidden" name="maxPipeLengthM" value="" />
              <input type="hidden" name="maxHeightDifferenceM" value="" />
              <input type="hidden" name="includedPipeLengthM" value="" />
              <input type="hidden" name="additionalChargeGPerM" value="" />
              <input type="hidden" name="liquidPipeDiameter" value="" />
              <input type="hidden" name="gasPipeDiameter" value="" />
              <div className="pac-form-note">
                {isSplit
                  ? "Pentru split cu liaison hydraulique, parametrii de liaisons frigorifiques nu sunt necesari."
                  : "Pentru monobloc, nu este necesară o liaison între unități."}
              </div>
            </>
          )}
        </div>
      </section>

      <section className="card pac-form-section">
        <div className="pac-form-heading"><p className="eyebrow">Installation</p><h2>Électricité et hydraulique</h2></div>
        <div className="pac-form-grid">
          <label>{isSplit ? "Alimentation unité intérieure" : "Alimentation"}<input name="indoorPowerCable" defaultValue={indoorPowerValue} placeholder="Ex. 3G6 mm²" /></label>
          {isSplit ? (
            <label>Alimentation unité extérieure<input name="outdoorPowerCable" defaultValue={model?.outdoorPowerCable} placeholder="Ex. 5G2,5 mm²" /></label>
          ) : (
            <input type="hidden" name="outdoorPowerCable" value="" />
          )}
          <label>Protection recommandée<input name="recommendedProtection" defaultValue={model?.recommendedProtection} placeholder="Ex. C32 A" /></label>
          <label>Câble de communication<input name="communicationCable" defaultValue={model?.communicationCable} /></label>
          <label>Raccordements hydrauliques<input name="hydraulicConnections" defaultValue={model?.hydraulicConnections} /></label>
          <label>Débit minimal<input name="minimumFlow" defaultValue={model?.minimumFlow} /></label>
          <label>Volume d’eau minimal<input name="minimumWaterVolume" defaultValue={model?.minimumWaterVolume} /></label>
          <label>Température départ maximale<input name="maximumFlowTemperature" defaultValue={model?.maximumFlowTemperature} /></label>
          <label>Volume tampon recommandé<input name="bufferTankRecommendation" defaultValue={model?.bufferTankRecommendation} /></label>
        </div>
      </section>

      <section className="card pac-form-section">
        <div className="pac-form-heading"><p className="eyebrow">Connaissances internes</p><h2>Procédures et notes</h2></div>
        <div className="pac-notes-grid">
          <label>Mise en service<textarea name="commissioningNotes" rows={5} defaultValue={model?.commissioningNotes} placeholder="Procédure, paramètres importants…" /></label>
          <label>Notes d’installation<textarea name="installationNotes" rows={5} defaultValue={model?.installationNotes} placeholder="Particularités de pose propres à ce modèle…" /></label>
          <label>Notes internes<textarea name="internalNotes" rows={4} defaultValue={model?.internalNotes} placeholder="Retours terrain, points de vigilance…" /></label>
        </div>
      </section>

      <div className="pac-form-actions">
        <button className="button button-primary">{submitLabel}</button>
      </div>
    </form>
  );
}
