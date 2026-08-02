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
    <div className="entity-card-grid">
      {combinations.map((combination) => {
        const indoor = equipmentFor(combination.components, "INDOOR_UNIT");
        const outdoor = equipmentFor(combination.components, "OUTDOOR_UNIT");
        const needsReview = Boolean(
          indoor?.referenceNeedsReview || outdoor?.referenceNeedsReview,
        );
        return (
          <Link
            href={`/pac/technical/combinations/${combination.id}`}
            className={`entity-card${combination.active ? "" : " inactive"}`}
            key={combination.id}
          >
            <div className="entity-card-top">
              <span className="entity-card-icon"><Snowflake size={22} /></span>
              <div className="entity-card-title">
                <h2>{combination.name}</h2>
                <p>{combination.manufacturer.name} · {combination.productRange?.name || "Sans gamme"}</p>
              </div>
              <span className={`entity-card-pill ${combination.active ? "active" : "inactive"}`}>
                {combination.active ? "Actif" : "Inactif"}
              </span>
            </div>
            <div className="entity-card-rows">
              <div className="entity-card-row"><span>Unité extérieure</span><span>{outdoor?.manufacturerReference || "—"}</span></div>
              <div className="entity-card-row"><span>Unité intérieure</span><span>{indoor?.manufacturerReference || "—"}</span></div>
            </div>
            {needsReview && (
              <div className="technical-review-badge"><AlertTriangle size={13} /> Référence à vérifier</div>
            )}
          </Link>
        );
      })}
    </div>
  );
}
