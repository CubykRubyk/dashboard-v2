import Link from "next/link";
import { AlertTriangle, ArrowUpRight } from "lucide-react";
import type { EquipmentType } from "@/generated/prisma/enums";

interface CombinationEquipmentRow {
  manufacturerReference: string;
  name: string;
  type: EquipmentType;
  active: boolean;
  referenceNeedsReview: boolean;
}

interface CombinationRow {
  id: string;
  name: string;
  active: boolean;
  updatedAt: Date;
  manufacturer: { name: string };
  productRange: { name: string } | null;
  components: Array<{ role: EquipmentType; equipment: CombinationEquipmentRow }>;
}

function equipmentFor(
  components: CombinationRow["components"],
  role: "INDOOR_UNIT" | "OUTDOOR_UNIT",
) {
  return components.find((component) => component.role === role)?.equipment;
}

function ComponentCell({
  equipment,
}: {
  equipment?: CombinationEquipmentRow;
}) {
  if (!equipment) {
    return <span className="technical-component-missing">Composant manquant</span>;
  }
  return (
    <>
      <strong>{equipment.manufacturerReference}</strong>
      <small>{equipment.name}</small>
      {!equipment.active && <small className="technical-inline-warning">Inactif</small>}
    </>
  );
}

export function CombinationTable({
  combinations,
  emptyMessage,
}: {
  combinations: CombinationRow[];
  emptyMessage: string;
}) {
  if (combinations.length === 0) {
    return <section className="card technical-empty">{emptyMessage}</section>;
  }

  return (
    <section className="card technical-list-card">
      <div className="technical-table-wrap">
        <table className="technical-table combination-table">
          <thead>
            <tr>
              <th>Combinaison</th>
              <th>Fabricant / gamme</th>
              <th>Unité extérieure</th>
              <th>Unité intérieure</th>
              <th>Statut</th>
              <th>Mise à jour</th>
              <th><span className="sr-only">Ouvrir</span></th>
            </tr>
          </thead>
          <tbody>
            {combinations.map((combination) => {
              const indoor = equipmentFor(combination.components, "INDOOR_UNIT");
              const outdoor = equipmentFor(combination.components, "OUTDOOR_UNIT");
              const needsReview =
                indoor?.referenceNeedsReview || outdoor?.referenceNeedsReview;
              return (
                <tr
                  className={combination.active ? "" : "inactive"}
                  key={combination.id}
                >
                  <td>
                    <strong>{combination.name}</strong>
                    {needsReview && (
                      <span className="technical-review-badge">
                        <AlertTriangle size={13} /> Référence à vérifier
                      </span>
                    )}
                  </td>
                  <td>
                    <strong>{combination.manufacturer.name}</strong>
                    <small>{combination.productRange?.name || "Sans gamme"}</small>
                  </td>
                  <td><ComponentCell equipment={outdoor} /></td>
                  <td><ComponentCell equipment={indoor} /></td>
                  <td>
                    <span className={`status-dot ${combination.active ? "active" : ""}`}>
                      {combination.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    {new Intl.DateTimeFormat("fr-FR", {
                      dateStyle: "short",
                    }).format(combination.updatedAt)}
                  </td>
                  <td>
                    <Link
                      href={`/pac/technical/combinations/${combination.id}`}
                      className="mini-action"
                      aria-label={`Ouvrir ${combination.name}`}
                    >
                      <ArrowUpRight size={15} />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
