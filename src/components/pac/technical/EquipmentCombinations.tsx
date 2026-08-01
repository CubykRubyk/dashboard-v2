import Link from "next/link";
import { ArrowUpRight, Network } from "lucide-react";
import type { EquipmentType } from "@/generated/prisma/enums";
import { equipmentTypeLabels } from "@/lib/hvac/labels";

interface EquipmentCombinationPart {
  role: EquipmentType;
  systemCombination: {
    id: string;
    name: string;
    active: boolean;
    components: Array<{
      role: EquipmentType;
      equipment: {
        id: string;
        manufacturerReference: string;
        name: string;
        active: boolean;
      };
    }>;
  };
}

export function EquipmentCombinations({
  equipmentId,
  combinations,
}: {
  equipmentId: string;
  combinations: EquipmentCombinationPart[];
}) {
  return (
    <section className="card technical-list-card equipment-combinations-card">
      <div className="technical-list-heading">
        <span className="technical-heading-icon"><Network size={18} /></span>
        <div>
          <h2>Combinaisons compatibles</h2>
          <p>Systèmes dans lesquels cette référence est utilisée.</p>
        </div>
      </div>
      {combinations.length === 0 ? (
        <div className="technical-empty">
          Cet équipement ne participe à aucune combinaison.
        </div>
      ) : (
        <div className="technical-table-wrap">
          <table className="technical-table">
            <thead>
              <tr>
                <th>Combinaison</th>
                <th>Rôle actuel</th>
                <th>Autre composant</th>
                <th>Statut</th>
                <th><span className="sr-only">Ouvrir</span></th>
              </tr>
            </thead>
            <tbody>
              {combinations.map((part) => {
                const other = part.systemCombination.components.find(
                  (component) => component.equipment.id !== equipmentId
                    && (
                      component.role === "INDOOR_UNIT"
                      || component.role === "OUTDOOR_UNIT"
                    ),
                );
                return (
                  <tr
                    className={part.systemCombination.active ? "" : "inactive"}
                    key={part.systemCombination.id}
                  >
                    <td><strong>{part.systemCombination.name}</strong></td>
                    <td>
                      <span className={`equipment-type-badge type-${part.role.toLowerCase()}`}>
                        {equipmentTypeLabels[part.role]}
                      </span>
                    </td>
                    <td>
                      {other ? (
                        <>
                          <strong>{other.equipment.manufacturerReference}</strong>
                          <small>
                            {other.equipment.name}
                            {other.equipment.active ? "" : " · inactif"}
                          </small>
                        </>
                      ) : (
                        <span className="technical-component-missing">
                          Composant manquant
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`status-dot ${part.systemCombination.active ? "active" : ""}`}>
                        {part.systemCombination.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <Link
                        className="mini-action"
                        href={`/pac/technical/combinations/${part.systemCombination.id}`}
                        aria-label={`Ouvrir ${part.systemCombination.name}`}
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
  );
}
