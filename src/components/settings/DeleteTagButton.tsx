"use client";

import { Trash2 } from "lucide-react";

export function DeleteTagButton({
  action,
  name,
  usageCount,
}: {
  action: () => Promise<void>;
  name: string;
  usageCount: number;
}) {
  const confirmation = usageCount
    ? `Supprimer le tag « ${name} » ? Il sera retiré de ${usageCount} fiche${usageCount > 1 ? "s" : ""}, sans supprimer les fiches.`
    : `Supprimer définitivement le tag « ${name} » ?`;

  return (
    <form action={action}>
      <button
        className="mini-action tag-delete-action"
        title="Supprimer"
        onClick={(event) => {
          if (!window.confirm(confirmation)) event.preventDefault();
        }}
      >
        <Trash2 size={14} /> Supprimer
      </button>
    </form>
  );
}
