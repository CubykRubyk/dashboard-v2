"use client";

import { useEffect, useState } from "react";
import { FileText, Package } from "lucide-react";

import { useT } from "./MobilePreferences";
import styles from "./mobile.module.css";

interface MaterialDocument {
  id: string;
  title: string;
  type: string;
}

interface Material {
  id: string;
  quantity: number;
  equipment: { reference: string; manufacturer: string; name: string };
  documents: MaterialDocument[];
}

/**
 * Matériel à poser, affiché dans le détail d'une intervention sur mobile — **pour tout le monde**,
 * technicien compris. C'est le cœur de la demande : arriver sur le chantier et avoir sous la main
 * la documentation du matériel qu'on installe, sans le chercher dans la bibliothèque.
 *
 * Lecture seule ici : la modification passe par l'écran d'édition, réservé aux administrateurs.
 */
export function InterventionMaterialsList({ interventionId }: { interventionId: string }) {
  const t = useT();
  const [materials, setMaterials] = useState<Material[] | null>(null);

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

  // Rien à afficher tant qu'aucun matériel n'est prévu : une section vide sur un petit écran ne
  // fait qu'éloigner le reste du contenu.
  if (!materials || materials.length === 0) return null;

  return (
    <div className={styles.materialCard}>
      <small>{t("detail.materials")}</small>
      {materials.map((material) => (
        <div key={material.id} className={styles.materialItem}>
          <div className={styles.materialItemHead}>
            <Package aria-hidden size={15} />
            <span className={styles.materialItemInfo}>
              <strong>
                {material.quantity > 1 ? `${material.quantity} × ` : ""}
                {material.equipment.reference}
              </strong>
              <small>
                {[material.equipment.manufacturer, material.equipment.name]
                  .filter(Boolean)
                  .join(" · ")}
              </small>
            </span>
          </div>
          {material.documents.map((document) => (
            <a
              key={document.id}
              className={styles.materialItemDoc}
              href={`/api/pac/technical/documents/${document.id}`}
              target="_blank"
              rel="noreferrer"
            >
              <FileText aria-hidden size={14} />
              {document.title}
            </a>
          ))}
        </div>
      ))}
    </div>
  );
}
