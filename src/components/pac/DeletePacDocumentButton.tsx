"use client";

import { Trash2 } from "lucide-react";

export function DeletePacDocumentButton({
  action,
  assignmentCount,
  name,
}: {
  action: () => Promise<void>;
  assignmentCount: number;
  name: string;
}) {
  return (
    <form action={action}>
      <button
        className="mini-action tag-delete-action"
        title="Supprimer le document"
        onClick={(event) => {
          if (!confirm(
            `Supprimer définitivement le document « ${name} » pour ${assignmentCount} modèle${assignmentCount === 1 ? "" : "s"} ?`,
          )) {
            event.preventDefault();
          }
        }}
      >
        <Trash2 size={14} />
      </button>
    </form>
  );
}
