import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
} from "lucide-react";
import type { EquipmentType } from "@/generated/prisma/enums";
import { equipmentTypeLabels } from "@/lib/hvac/labels";

interface EquipmentRow {
  id: string;
  manufacturerReference: string;
  normalizedReference: string;
  name: string;
  type: EquipmentType;
  active: boolean;
  referenceNeedsReview: boolean;
  manufacturer: { name: string };
  productRange: { name: string } | null;
}

export function EquipmentTable({
  equipment,
}: {
  equipment: EquipmentRow[];
}) {
  if (equipment.length === 0) {
    return (
      <section className="card technical-empty">
        Aucun équipement ne correspond aux critères.
      </section>
    );
  }

  return (
    <section className="card technical-list-card">
      <div className="technical-table-wrap">
        <table className="technical-table equipment-table">
          <thead>
            <tr>
              <th>Référence</th>
              <th>Désignation</th>
              <th>Type</th>
              <th>Fabricant</th>
              <th>Gamme</th>
              <th>Statut</th>
              <th><span className="sr-only">Ouvrir</span></th>
            </tr>
          </thead>
          <tbody>
            {equipment.map((item) => (
              <tr className={item.active ? "" : "inactive"} key={item.id}>
                <td>
                  <strong>{item.manufacturerReference}</strong>
                  <small>{item.normalizedReference}</small>
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
                <td>{item.manufacturer.name}</td>
                <td>{item.productRange?.name || "—"}</td>
                <td>
                  <span className={`status-dot ${item.active ? "active" : ""}`}>
                    {item.active ? "Actif" : "Inactif"}
                  </span>
                </td>
                <td>
                  <Link
                    href={`/pac/technical/equipment/${item.id}`}
                    className="mini-action"
                    aria-label={`Ouvrir ${item.manufacturerReference}`}
                  >
                    <ArrowUpRight size={15} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
