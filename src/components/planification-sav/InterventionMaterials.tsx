"use client";

import { useEffect, useState } from "react";
import { FileText, Package, Plus, Search, Trash2 } from "lucide-react";

import styles from "./planification-sav.module.css";

interface MaterialDocument {
  id: string;
  title: string;
  type: string;
  isPrimary: boolean;
}

export interface InterventionMaterialView {
  id: string;
  quantity: number;
  note: string;
  equipment: {
    id: string;
    name: string;
    reference: string;
    manufacturer: string;
    type: string;
  };
  documents: MaterialDocument[];
}

interface EquipmentResult {
  id: string;
  name: string;
  reference: string;
  manufacturer: string;
  documentCount: number;
}

const DOCUMENT_LABELS: Record<string, string> = {
  INSTALLATION_MANUAL: "Manuel d’installation",
  USER_MANUAL: "Manuel utilisateur",
  DATASHEET: "Fiche technique",
  WIRING_DIAGRAM: "Schéma de raccordement",
  ERROR_CODES: "Codes d’erreur",
  CERTIFICATE: "Certificat",
  OTHER: "Document",
};

/**
 * Matériel à poser sur une intervention, choisi **dans le catalogue PAC** (jamais en texte libre) :
 * c'est ce qui permet d'afficher la documentation du matériel au technicien.
 *
 * En lecture seule (`canManage` faux), le composant sert aussi côté technicien — il voit ce qu'il
 * a à installer et ouvre les manuels, sans pouvoir modifier la liste.
 */
export function InterventionMaterials({
  interventionId,
  canManage,
}: {
  interventionId: string;
  canManage: boolean;
}) {
  const [materials, setMaterials] = useState<InterventionMaterialView[] | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EquipmentResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Chargement initial dans un `.then` : seule forme acceptée par `react-hooks/set-state-in-effect`.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/planification-sav/interventions/${interventionId}/materials`)
      .then((response) => (response.ok ? response.json() : { materials: [] }))
      .then((data) => {
        if (!cancelled) setMaterials(data.materials ?? []);
      })
      .catch(() => {
        if (!cancelled) setMaterials([]);
      });
    return () => {
      cancelled = true;
    };
  }, [interventionId]);

  // Recherche différée : sans ce délai, chaque frappe déclencherait une requête catalogue.
  // Aucun `setResults([])` synchrone ici — `visibleResults` (dérivé, plus bas) masque les résultats
  // dès que la saisie redevient trop courte, ce que la règle `react-hooks/set-state-in-effect`
  // interdirait de faire depuis le corps de l'effet.
  useEffect(() => {
    if (!canManage || query.trim().length < 2) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      fetch(`/api/pac/technical/equipment/search?q=${encodeURIComponent(query)}`)
        .then((response) => (response.ok ? response.json() : { equipment: [] }))
        .then((data) => {
          if (!cancelled) setResults(data.equipment ?? []);
        })
        .catch(() => undefined);
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, canManage]);

  // Dérivé plutôt que stocké : les résultats d'une recherche précédente ne doivent pas rester
  // affichés une fois le champ vidé.
  const visibleResults = canManage && query.trim().length >= 2 ? results : [];

  const add = async (equipmentId: string) => {
    setBusy(true);
    setError("");
    const response = await fetch(
      `/api/planification-sav/interventions/${interventionId}/materials`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ equipmentId, quantity: 1 }),
      },
    ).catch(() => null);
    setBusy(false);

    if (!response?.ok) {
      const body = await response?.json().catch(() => ({}));
      setError(body?.error ?? "Ajout impossible.");
      return;
    }
    setMaterials((await response.json()).materials);
    setQuery("");
    setResults([]);
  };

  const remove = async (materialId: string) => {
    setBusy(true);
    const response = await fetch(
      `/api/planification-sav/interventions/${interventionId}/materials?materialId=${materialId}`,
      { method: "DELETE" },
    ).catch(() => null);
    setBusy(false);
    if (response?.ok) setMaterials((await response.json()).materials);
  };

  return (
    <div className={styles.materialsWrap}>
      {error && <p className={styles.materialsError}>{error}</p>}

      {materials === null && <p className={styles.materialsEmpty}>Chargement…</p>}
      {materials?.length === 0 && (
        <p className={styles.materialsEmpty}>
          {canManage ? "Aucun matériel renseigné." : "Aucun matériel prévu pour cette intervention."}
        </p>
      )}

      {materials?.map((material) => (
        <article key={material.id} className={styles.materialRow}>
          <div className={styles.materialHead}>
            <Package aria-hidden size={15} />
            <div className={styles.materialInfo}>
              <strong>
                {material.quantity > 1 ? `${material.quantity} × ` : ""}
                {material.equipment.reference}
              </strong>
              <small>
                {[material.equipment.manufacturer, material.equipment.name]
                  .filter(Boolean)
                  .join(" · ")}
              </small>
            </div>
            {canManage && (
              <button
                type="button"
                className={styles.materialRemove}
                disabled={busy}
                aria-label={`Retirer ${material.equipment.reference}`}
                onClick={() => remove(material.id)}
              >
                <Trash2 aria-hidden size={14} />
              </button>
            )}
          </div>

          {material.documents.length === 0 ? (
            <p className={styles.materialNoDoc}>Aucune documentation pour cette référence.</p>
          ) : (
            material.documents.map((document) => (
              <a
                key={document.id}
                className={styles.materialDoc}
                href={`/api/pac/technical/documents/${document.id}`}
                target="_blank"
                rel="noreferrer"
              >
                <FileText aria-hidden size={14} />
                <span>{document.title}</span>
                <small>{DOCUMENT_LABELS[document.type] ?? document.type}</small>
              </a>
            ))
          )}
        </article>
      ))}

      {canManage && (
        <div className={styles.materialSearch}>
          <label>
            <span className={styles.materialSearchField}>
              <Search aria-hidden size={15} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Chercher dans le catalogue (référence, fabricant…)"
              />
            </span>
          </label>
          {visibleResults.map((result) => (
            <button
              key={result.id}
              type="button"
              className={styles.materialResult}
              disabled={busy}
              onClick={() => add(result.id)}
            >
              <Plus aria-hidden size={14} />
              <span className={styles.materialInfo}>
                <strong>{result.reference}</strong>
                <small>
                  {[result.manufacturer, result.name].filter(Boolean).join(" · ")}
                  {result.documentCount > 0 ? ` · ${result.documentCount} doc.` : " · sans doc."}
                </small>
              </span>
            </button>
          ))}
          {query.trim().length >= 2 && visibleResults.length === 0 && (
            <p className={styles.materialsEmpty}>
              Aucun résultat. Ajoutez la référence au catalogue depuis « Ajouter une pompe ».
            </p>
          )}
        </div>
      )}
    </div>
  );
}
