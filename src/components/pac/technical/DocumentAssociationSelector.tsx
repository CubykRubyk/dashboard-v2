"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  Network,
  Search,
  X,
} from "lucide-react";
import type { EquipmentType } from "@/generated/prisma/enums";
import { equipmentTypeLabels } from "@/lib/hvac/labels";
import { normalizeEquipmentReference } from "@/lib/hvac/normalization";

export interface DocumentEquipmentOption {
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

export interface DocumentCombinationOption {
  id: string;
  name: string;
  active: boolean;
  manufacturer: { name: string };
  productRange: { name: string } | null;
  components: Array<{
    role: EquipmentType;
    equipment: {
      manufacturerReference: string;
      normalizedReference: string;
      name: string;
      referenceNeedsReview: boolean;
    };
  }>;
}

function normalizedSearch(value: string) {
  return normalizeEquipmentReference(value);
}

function includesQuery(values: Array<string | undefined>, query: string) {
  const normalized = normalizedSearch(query);
  return values.some(
    (value) => value
      && (
        value.toLocaleLowerCase("fr").includes(query.toLocaleLowerCase("fr"))
        || normalizedSearch(value).includes(normalized)
      ),
  );
}

function componentReference(
  combination: DocumentCombinationOption,
  role: "INDOOR_UNIT" | "OUTDOOR_UNIT",
) {
  return combination.components.find((component) => component.role === role)
    ?.equipment.manufacturerReference;
}

export function DocumentAssociationSelector({
  equipment,
  combinations,
  initialEquipmentIds = [],
  initialCombinationIds = [],
  readOnly = false,
}: {
  equipment: DocumentEquipmentOption[];
  combinations: DocumentCombinationOption[];
  initialEquipmentIds?: string[];
  initialCombinationIds?: string[];
  readOnly?: boolean;
}) {
  const [equipmentQuery, setEquipmentQuery] = useState("");
  const [combinationQuery, setCombinationQuery] = useState("");
  const [equipmentIds, setEquipmentIds] = useState(initialEquipmentIds);
  const [combinationIds, setCombinationIds] = useState(initialCombinationIds);
  const selectedEquipment = equipment.filter((item) =>
    equipmentIds.includes(item.id)
  );
  const selectedCombinations = combinations.filter((item) =>
    combinationIds.includes(item.id)
  );
  const visibleEquipment = useMemo(
    () => equipment.filter((item) => (
      (item.active || equipmentIds.includes(item.id))
      && !equipmentIds.includes(item.id)
      && (
        !equipmentQuery
        || includesQuery([
          item.manufacturerReference,
          item.normalizedReference,
          item.name,
          item.manufacturer.name,
          item.productRange?.name,
          equipmentTypeLabels[item.type],
        ], equipmentQuery)
      )
    )).slice(0, 40),
    [equipment, equipmentIds, equipmentQuery],
  );
  const visibleCombinations = useMemo(
    () => combinations.filter((item) => (
      (item.active || combinationIds.includes(item.id))
      && !combinationIds.includes(item.id)
      && (
        !combinationQuery
        || includesQuery([
          item.name,
          item.manufacturer.name,
          item.productRange?.name,
          ...item.components.flatMap((component) => [
            component.equipment.manufacturerReference,
            component.equipment.normalizedReference,
            component.equipment.name,
          ]),
        ], combinationQuery)
      )
    )).slice(0, 40),
    [combinationIds, combinationQuery, combinations],
  );

  return (
    <div className="document-association-grid">
      {equipmentIds.map((id) => (
        <input name="equipmentIds" type="hidden" value={id} key={id} />
      ))}
      {combinationIds.map((id) => (
        <input
          name="systemCombinationIds"
          type="hidden"
          value={id}
          key={id}
        />
      ))}

      <section className="document-association-panel">
        <div className="document-association-heading">
          <Boxes size={18} />
          <div>
            <h3>Équipements</h3>
            <p>{equipmentIds.length} sélectionné(s)</p>
          </div>
        </div>
        <div className="document-selected-associations">
          {selectedEquipment.length === 0 && (
            <p className="document-association-empty">Aucun équipement associé.</p>
          )}
          {selectedEquipment.map((item) => (
            <div className="document-association-chip" key={item.id}>
              <div>
                <strong>{item.manufacturerReference}</strong>
                <small>
                  {item.manufacturer.name} · {equipmentTypeLabels[item.type]}
                  {item.productRange ? ` · ${item.productRange.name}` : ""}
                  {item.active ? "" : " · inactif"}
                </small>
              </div>
              {item.referenceNeedsReview && (
                <AlertTriangle size={14} aria-label="Référence à vérifier" />
              )}
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => setEquipmentIds(
                    (current) => current.filter((id) => id !== item.id),
                  )}
                  aria-label={`Retirer ${item.manufacturerReference}`}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
        {!readOnly && (
          <>
            <label className="document-association-search">
              Rechercher un équipement
              <span className="filter-input-shell">
                <Search size={15} />
                <input
                  value={equipmentQuery}
                  onChange={(event) => setEquipmentQuery(event.currentTarget.value)}
                  placeholder="Référence, nom, fabricant, gamme ou type…"
                />
              </span>
            </label>
            <div className="document-association-results">
              {visibleEquipment.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setEquipmentIds((current) => [...current, item.id])}
                >
                  <strong>{item.manufacturerReference}</strong>
                  <small>
                    {item.name} · {item.manufacturer.name}
                    {item.productRange ? ` · ${item.productRange.name}` : ""}
                  </small>
                  {item.referenceNeedsReview && <AlertTriangle size={13} />}
                </button>
              ))}
              {visibleEquipment.length === 0 && (
                <p>Aucun équipement actif ne correspond.</p>
              )}
            </div>
          </>
        )}
      </section>

      <section className="document-association-panel">
        <div className="document-association-heading">
          <Network size={18} />
          <div>
            <h3>Combinaisons</h3>
            <p>{combinationIds.length} sélectionnée(s)</p>
          </div>
        </div>
        <div className="document-selected-associations">
          {selectedCombinations.length === 0 && (
            <p className="document-association-empty">Aucune combinaison associée.</p>
          )}
          {selectedCombinations.map((item) => {
            const needsReview = item.components.some(
              (component) => component.equipment.referenceNeedsReview,
            );
            return (
              <div className="document-association-chip" key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <small>
                    {item.manufacturer.name}
                    {item.productRange ? ` · ${item.productRange.name}` : ""}
                    {item.active ? "" : " · inactive"}
                  </small>
                </div>
                {needsReview && (
                  <AlertTriangle size={14} aria-label="Référence à vérifier" />
                )}
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => setCombinationIds(
                      (current) => current.filter((id) => id !== item.id),
                    )}
                    aria-label={`Retirer ${item.name}`}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {!readOnly && (
          <>
            <label className="document-association-search">
              Rechercher une combinaison
              <span className="filter-input-shell">
                <Search size={15} />
                <input
                  value={combinationQuery}
                  onChange={(event) =>
                    setCombinationQuery(event.currentTarget.value)
                  }
                  placeholder="Nom, référence UI / UE, fabricant ou gamme…"
                />
              </span>
            </label>
            <div className="document-association-results">
              {visibleCombinations.map((item) => {
                const outdoor = componentReference(item, "OUTDOOR_UNIT");
                const indoor = componentReference(item, "INDOOR_UNIT");
                const needsReview = item.components.some(
                  (component) => component.equipment.referenceNeedsReview,
                );
                return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => setCombinationIds(
                      (current) => [...current, item.id],
                    )}
                  >
                    <strong>{item.name}</strong>
                    <small>
                      {item.manufacturer.name} · UE {outdoor || "—"} · UI{" "}
                      {indoor || "—"}
                    </small>
                    {needsReview && <AlertTriangle size={13} />}
                  </button>
                );
              })}
              {visibleCombinations.length === 0 && (
                <p>Aucune combinaison active ne correspond.</p>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
