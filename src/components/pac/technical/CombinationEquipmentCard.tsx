import Link from "next/link";
import { AlertTriangle, ArrowUpRight } from "lucide-react";
import type {
  ElectricalSupply,
  EquipmentType,
} from "@/generated/prisma/enums";
import {
  electricalSupplyLabels,
  equipmentTypeLabels,
} from "@/lib/hvac/labels";

export interface CombinationEquipmentCardValue {
  id: string;
  manufacturerReference: string;
  name: string;
  type: EquipmentType;
  active: boolean;
  referenceNeedsReview: boolean;
  electricalSupply: ElectricalSupply | null;
  recommendedProtection: string;
  powerCable: string;
  communicationCable: string;
  factoryChargeKg: number | null;
  liquidPipeDiameter: string;
  gasPipeDiameter: string;
  maxPipeLengthM: number | null;
  maxHeightDifferenceM: number | null;
  hydraulicConnections: string;
  minimumFlow: string;
  minimumWaterVolume: string;
  maximumFlowTemperature: string;
  nominalPowerKw: number | null;
  productRange: { name: string } | null;
  refrigerant: { name: string } | null;
}

function TechnicalValue({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  if (value == null || value === "") return null;
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function CombinationEquipmentCard({
  title,
  equipment,
}: {
  title: string;
  equipment?: CombinationEquipmentCardValue;
}) {
  if (!equipment) {
    return (
      <section className="card combination-equipment-card">
        <h2>{title}</h2>
        <div className="alert alert-danger">Composant manquant ou invalide.</div>
      </section>
    );
  }

  return (
    <section className="card combination-equipment-card">
      <div className="combination-equipment-heading">
        <div>
          <p className="eyebrow">{title}</p>
          <h2>{equipment.manufacturerReference}</h2>
          <p>{equipment.name}</p>
        </div>
        <Link
          className="mini-action"
          href={`/pac/technical/equipment/${equipment.id}`}
          aria-label={`Ouvrir ${equipment.manufacturerReference}`}
        >
          <ArrowUpRight size={16} />
        </Link>
      </div>
      <div className="technical-detail-badges">
        <span className={`equipment-type-badge type-${equipment.type.toLowerCase()}`}>
          {equipmentTypeLabels[equipment.type]}
        </span>
        <span className={`status-dot ${equipment.active ? "active" : ""}`}>
          {equipment.active ? "Actif" : "Inactif"}
        </span>
        {equipment.productRange && (
          <span className="equipment-type-badge">{equipment.productRange.name}</span>
        )}
      </div>

      {equipment.referenceNeedsReview && (
        <div className="technical-review-alert combination-card-warning">
          <AlertTriangle size={17} />
          <div>
            <strong>Référence legacy à vérifier</strong>
            <p>
              <Link href={`/pac/technical/equipment/${equipment.id}`}>
                Corriger la fiche équipement
              </Link>
            </p>
          </div>
        </div>
      )}
      {!equipment.active && (
        <div className="alert alert-danger combination-card-warning">
          Ce composant est inactif, mais reste associé à la combinaison.
        </div>
      )}

      <dl className="combination-technical-values">
        <TechnicalValue
          label="Puissance nominale"
          value={equipment.nominalPowerKw == null
            ? null
            : `${equipment.nominalPowerKw} kW`}
        />
        <TechnicalValue
          label="Alimentation"
          value={equipment.electricalSupply
            ? electricalSupplyLabels[equipment.electricalSupply]
            : null}
        />
        <TechnicalValue label="Protection" value={equipment.recommendedProtection} />
        <TechnicalValue label="Câble alimentation" value={equipment.powerCable} />
        <TechnicalValue label="Communication" value={equipment.communicationCable} />
        <TechnicalValue label="Réfrigérant" value={equipment.refrigerant?.name} />
        <TechnicalValue
          label="Charge usine"
          value={equipment.factoryChargeKg == null
            ? null
            : `${equipment.factoryChargeKg} kg`}
        />
        <TechnicalValue label="Diamètre liquide" value={equipment.liquidPipeDiameter} />
        <TechnicalValue label="Diamètre gaz" value={equipment.gasPipeDiameter} />
        <TechnicalValue
          label="Longueur maximale"
          value={equipment.maxPipeLengthM == null
            ? null
            : `${equipment.maxPipeLengthM} m`}
        />
        <TechnicalValue
          label="Dénivelé maximal"
          value={equipment.maxHeightDifferenceM == null
            ? null
            : `${equipment.maxHeightDifferenceM} m`}
        />
        <TechnicalValue label="Raccords hydrauliques" value={equipment.hydraulicConnections} />
        <TechnicalValue label="Débit minimal" value={equipment.minimumFlow} />
        <TechnicalValue label="Volume d’eau minimal" value={equipment.minimumWaterVolume} />
        <TechnicalValue label="Température départ maximale" value={equipment.maximumFlowTemperature} />
      </dl>
    </section>
  );
}
