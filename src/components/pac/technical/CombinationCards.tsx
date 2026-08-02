import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Snowflake, Zap } from "lucide-react";
import type {
  CombinationEquipmentRow,
  CombinationRow,
} from "@/components/pac/technical/CombinationTable";

function equipmentFor(
  components: CombinationRow["components"],
  role: "INDOOR_UNIT" | "OUTDOOR_UNIT",
) {
  return components.find((component) => component.role === role)?.equipment;
}

function UnitValue({
  equipment,
  label,
}: {
  equipment?: CombinationEquipmentRow;
  label: string;
}) {
  return (
    <div className="pac-combination-unit">
      <span>{label}</span>
      {equipment ? (
        <>
          <strong>{equipment.manufacturerReference}</strong>
          <small>{equipment.name}</small>
          {!equipment.active && <small className="technical-inline-warning">Inactive</small>}
        </>
      ) : (
        <small className="technical-component-missing">Composant manquant</small>
      )}
    </div>
  );
}

export function CombinationCards({
  combinations,
  emptyMessage,
}: {
  combinations: CombinationRow[];
  emptyMessage: string;
}) {
  if (combinations.length === 0) {
    return (
      <section className="card technical-empty">
        <Snowflake size={30} />
        <p>{emptyMessage}</p>
      </section>
    );
  }

  return (
    <div className="pac-combination-grid">
      {combinations.map((combination) => {
        const indoor = equipmentFor(combination.components, "INDOOR_UNIT");
        const outdoor = equipmentFor(combination.components, "OUTDOOR_UNIT");
        const needsReview = Boolean(
          indoor?.referenceNeedsReview || outdoor?.referenceNeedsReview,
        );
        return (
          <Link
            href={`/pac/technical/combinations/${combination.id}`}
            className={`card card-action action-elevate action-border-primary pac-combination-card${combination.active ? "" : " inactive"}`}
            key={combination.id}
          >
            <div className="card-header pac-card-header">
            <div className="pac-card-topline">
              <span className="pac-card-brand-mark"><Snowflake size={18} /></span>
              <div className="pac-card-context"><span className="pac-brand">{combination.manufacturer.name}</span><small>{combination.productRange?.name || "Gamme non renseignée"}</small></div>
              <span className={`status-dot ${combination.active ? "active" : ""}`}>
                {combination.active ? "Active" : "Inactive"}
              </span>
            </div>
            </div>
            <div className="card-body pac-card-body"><div className="pac-card-title"><h2>{combination.name}</h2><ArrowUpRight size={18} aria-hidden="true" /></div>
            <div className="pac-combination-units pac-card-pair">
              <UnitValue equipment={outdoor} label="Unité extérieure" />
              <span className="pac-card-link"><Zap size={13} /></span>
              <UnitValue equipment={indoor} label="Unité intérieure" />
            </div>
            </div><div className="card-footer pac-combination-footer">
              {needsReview ? (
                <span className="technical-review-badge">
                  <AlertTriangle size={13} /> Référence à vérifier
                </span>
              ) : (
                <small>Configuration UI + UE</small>
              )}
              <small className="pac-card-action">Voir la combinaison</small>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
