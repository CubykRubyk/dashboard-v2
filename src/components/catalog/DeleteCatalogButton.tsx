"use client";

import { Trash2 } from "lucide-react";

export function DeleteCatalogButton({
  action,
  kind,
  name,
  usageCount = 0,
  compact = false,
}: {
  action: () => Promise<void>;
  kind: "article" | "modèle" | "catégorie";
  name: string;
  usageCount?: number;
  compact?: boolean;
}) {
  const historicalNote = usageCount
    ? `\n\nIl est utilisé dans ${usageCount} fiche${usageCount > 1 ? "s" : ""}. Les fiches conserveront leur texte historique.`
    : "";
  const target =
    kind === "catégorie" ? "la catégorie" : kind === "article" ? "l’article" : "le modèle";
  const confirmation = `Supprimer définitivement ${target} « ${name} » ?` + historicalNote;

  return (
    <form action={action}>
      <button
        className={`mini-action catalog-delete-action${compact ? " compact" : ""}`}
        title={`Supprimer ${kind}`}
        aria-label={`Supprimer ${kind} ${name}`}
        onClick={(event) => {
          if (!window.confirm(confirmation)) event.preventDefault();
        }}
      >
        <Trash2 size={14} />
        {!compact && "Supprimer"}
      </button>
    </form>
  );
}
