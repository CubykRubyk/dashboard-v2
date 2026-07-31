"use client";

import { Trash2 } from "lucide-react";

export function DeletePacDocumentButton({
  action,
  name,
}: {
  action: () => Promise<void>;
  name: string;
}) {
  return (
    <form action={action}>
      <button
        className="mini-action tag-delete-action"
        title="Supprimer le document"
        onClick={(event) => {
          if (!confirm(`Supprimer définitivement le document « ${name} » ?`)) {
            event.preventDefault();
          }
        }}
      >
        <Trash2 size={14} />
      </button>
    </form>
  );
}
