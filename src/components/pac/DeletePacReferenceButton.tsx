"use client";

import { Trash2 } from "lucide-react";

export function DeletePacReferenceButton({
  action,
  label,
}: {
  action: () => Promise<void>;
  label: string;
}) {
  return (
    <form action={action}>
      <button
        className="mini-action pac-reference-delete"
        title={`Supprimer ${label}`}
        aria-label={`Supprimer ${label}`}
        onClick={(event) => {
          if (!window.confirm(`Supprimer définitivement « ${label} » ?`)) {
            event.preventDefault();
          }
        }}
      >
        <Trash2 size={14} />
      </button>
    </form>
  );
}
