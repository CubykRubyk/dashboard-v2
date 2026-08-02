import Link from "next/link";
import { AlertTriangle, Snowflake } from "lucide-react";
import type { CombinationRow } from "@/components/pac/technical/CombinationTable";

function equipmentFor(
  components: CombinationRow["components"],
  role: "INDOOR_UNIT" | "OUTDOOR_UNIT",
) {
  return components.find((component) => component.role === role)?.equipment;
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
            className={`card card-action action-elevate gx-elevated-card gx-elevated-${combination.active ? "primary" : "muted"}${combination.active ? "" : " inactive"}`}
            key={combination.id}
          >
            <div className="card-body gx-elevated-body"><div className="gx-elevated-head"><span className="gx-elevated-avatar"><Snowflake size={22} /></span><div><h2>{combination.name}</h2><p>{combination.manufacturer.name} · {combination.productRange?.name || "Sans gamme"}</p></div><span className={`status-dot ${combination.active ? "active" : ""}`}>{combination.active ? "Actif" : "Inactif"}</span></div><div className="gx-elevated-statbox"><div><strong>{outdoor?.manufacturerReference || "—"}</strong><span>Unité extérieure</span></div><div className="gx-elevated-divider" /><div><strong>{indoor?.manufacturerReference || "—"}</strong><span>Unité intérieure</span></div></div><div className="gx-elevated-meta"><div><span>Modèle UE</span><strong>{outdoor?.name || "Non renseigné"}</strong></div><div><span>Modèle UI</span><strong>{indoor?.name || "Non renseigné"}</strong></div></div>{needsReview && <div className="technical-review-badge"><AlertTriangle size={13} /> Référence à vérifier</div>}<span className="button button-primary gx-elevated-action">Voir la combinaison</span></div>
          </Link>
        );
      })}
    </div>
  );
}
