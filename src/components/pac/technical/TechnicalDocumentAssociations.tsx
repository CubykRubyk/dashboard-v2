import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Boxes, Network } from "lucide-react";
import type { EquipmentType } from "@/generated/prisma/enums";
import { equipmentTypeLabels } from "@/lib/hvac/labels";

interface AssociatedEquipment {
  id: string;
  manufacturerReference: string;
  name: string;
  type: EquipmentType;
  active: boolean;
  referenceNeedsReview: boolean;
  manufacturer: { name: string };
  productRange: { name: string } | null;
}

interface AssociatedCombination {
  id: string;
  name: string;
  active: boolean;
  manufacturer: { name: string };
  productRange: { name: string } | null;
  components: Array<{
    role: EquipmentType;
    equipment: {
      manufacturerReference: string;
      referenceNeedsReview: boolean;
    };
  }>;
}

function combinationReference(
  combination: AssociatedCombination,
  role: "INDOOR_UNIT" | "OUTDOOR_UNIT",
) {
  return combination.components.find((component) => component.role === role)
    ?.equipment.manufacturerReference || "—";
}

export function TechnicalDocumentAssociations({
  equipment,
  combinations,
}: {
  equipment: AssociatedEquipment[];
  combinations: AssociatedCombination[];
}) {
  return (
    <div className="document-detail-associations">
      <section className="card technical-list-card">
        <div className="technical-list-heading">
          <span className="technical-heading-icon"><Boxes size={18} /></span>
          <div>
            <h2>Équipements associés</h2>
            <p>{equipment.length} référence(s)</p>
          </div>
        </div>
        {equipment.length === 0 ? (
          <div className="technical-empty">Aucun équipement associé.</div>
        ) : (
          <div className="technical-table-wrap">
            <table className="technical-table">
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Désignation</th>
                  <th>Type</th>
                  <th>Fabricant / gamme</th>
                  <th>Statut</th>
                  <th><span className="sr-only">Ouvrir</span></th>
                </tr>
              </thead>
              <tbody>
                {equipment.map((item) => (
                  <tr className={item.active ? "" : "inactive"} key={item.id}>
                    <td>
                      <strong>{item.manufacturerReference}</strong>
                      {item.referenceNeedsReview && (
                        <span className="technical-review-badge">
                          <AlertTriangle size={13} /> À vérifier
                        </span>
                      )}
                    </td>
                    <td>{item.name}</td>
                    <td>
                      <span className={`equipment-type-badge type-${item.type.toLowerCase()}`}>
                        {equipmentTypeLabels[item.type]}
                      </span>
                    </td>
                    <td>
                      <strong>{item.manufacturer.name}</strong>
                      <small>{item.productRange?.name || "Sans gamme"}</small>
                    </td>
                    <td>
                      <span className={`status-dot ${item.active ? "active" : ""}`}>
                        {item.active ? "Actif" : "Inactif"}
                      </span>
                    </td>
                    <td>
                      <Link
                        className="mini-action"
                        href={`/pac/technical/equipment/${item.id}`}
                      >
                        <ArrowUpRight size={15} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card technical-list-card">
        <div className="technical-list-heading">
          <span className="technical-heading-icon"><Network size={18} /></span>
          <div>
            <h2>Combinaisons associées</h2>
            <p>{combinations.length} système(s)</p>
          </div>
        </div>
        {combinations.length === 0 ? (
          <div className="technical-empty">Aucune combinaison associée.</div>
        ) : (
          <div className="technical-table-wrap">
            <table className="technical-table">
              <thead>
                <tr>
                  <th>Combinaison</th>
                  <th>Fabricant / gamme</th>
                  <th>Unité extérieure</th>
                  <th>Unité intérieure</th>
                  <th>Statut</th>
                  <th><span className="sr-only">Ouvrir</span></th>
                </tr>
              </thead>
              <tbody>
                {combinations.map((item) => {
                  const needsReview = item.components.some(
                    (component) => component.equipment.referenceNeedsReview,
                  );
                  return (
                    <tr className={item.active ? "" : "inactive"} key={item.id}>
                      <td>
                        <strong>{item.name}</strong>
                        {needsReview && (
                          <span className="technical-review-badge">
                            <AlertTriangle size={13} /> À vérifier
                          </span>
                        )}
                      </td>
                      <td>
                        <strong>{item.manufacturer.name}</strong>
                        <small>{item.productRange?.name || "Sans gamme"}</small>
                      </td>
                      <td>{combinationReference(item, "OUTDOOR_UNIT")}</td>
                      <td>{combinationReference(item, "INDOOR_UNIT")}</td>
                      <td>
                        <span className={`status-dot ${item.active ? "active" : ""}`}>
                          {item.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>
                        <Link
                          className="mini-action"
                          href={`/pac/technical/combinations/${item.id}`}
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
        )}
      </section>
    </div>
  );
}
