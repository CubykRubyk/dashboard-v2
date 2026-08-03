"use client";

import { Trash2 } from "lucide-react";

export function DeleteTeamButton({
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
        title="Supprimer"
        onClick={(event) => {
          if (!window.confirm(`Supprimer définitivement l’équipe « ${name} » ?`)) event.preventDefault();
        }}
      >
        <Trash2 size={14} /> Supprimer
      </button>
    </form>
  );
}
