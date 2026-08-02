"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, RotateCw, Trash2 } from "lucide-react";

export function GeneratedDocumentActions({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"regenerate" | "delete" | "">("");

  const download = () => {
    window.location.href = `/api/documents/generated/${documentId}/file`;
  };

  const regenerate = async () => {
    setBusy("regenerate");
    const response = await fetch(`/api/documents/generated/${documentId}`, { method: "PUT" });
    if (response.ok) {
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `document-${documentId}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      router.refresh();
    }
    setBusy("");
  };

  const remove = async () => {
    if (!window.confirm("Supprimer ce document généré ?")) return;
    setBusy("delete");
    const response = await fetch(`/api/documents/generated/${documentId}`, { method: "DELETE" });
    setBusy("");
    if (response.ok) router.refresh();
  };

  return (
    <div className="docgen-row-actions">
      <button className="button button-ghost button-small" onClick={download} type="button" title="Télécharger">
        <Download size={14} />
      </button>
      <button
        className="button button-ghost button-small"
        onClick={regenerate}
        type="button"
        disabled={busy === "regenerate"}
        title="Régénérer"
      >
        <RotateCw size={14} />
      </button>
      <button
        className="button button-ghost button-small"
        onClick={remove}
        type="button"
        disabled={busy === "delete"}
        title="Supprimer"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
