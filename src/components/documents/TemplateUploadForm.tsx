"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud } from "lucide-react";

export function TemplateUploadForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) {
      setError("Sélectionnez un fichier PDF.");
      return;
    }
    setBusy(true);
    setError("");
    const formData = new FormData();
    formData.append("name", name);
    formData.append("file", file);
    const response = await fetch("/api/documents/templates", { method: "POST", body: formData });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(result.error || "Une erreur est survenue.");
      return;
    }
    router.push(`/documents/templates/${result.template.id}`);
  };

  return (
    <form className="settings-form" onSubmit={submit}>
      <label>
        Nom du modèle
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Ex : Attestation CERFA"
          required
        />
      </label>
      <label>
        Fichier PDF
        <input
          type="file"
          accept="application/pdf"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          required
        />
        <small>Le PDF doit contenir des champs de formulaire (AcroForm) : ils seront détectés automatiquement.</small>
      </label>
      <div className="settings-actions">
        <button className="button button-primary" type="submit" disabled={busy}>
          <UploadCloud size={16} /> {busy ? "Import en cours…" : "Importer et détecter les champs"}
        </button>
      </div>
      {error && <div className="alert alert-danger">{error}</div>}
    </form>
  );
}
