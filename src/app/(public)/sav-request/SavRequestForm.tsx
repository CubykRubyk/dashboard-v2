"use client";

import { useRef, useState } from "react";
import { CheckCircle2, Paperclip, Send } from "lucide-react";

const MAX_FILES = 20;

export function SavRequestForm() {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [reference, setReference] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const [fileNames, setFileNames] = useState<string[]>([]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSending(true);
    setError("");

    const response = await fetch("/api/sav-request", {
      method: "POST",
      body: new FormData(event.currentTarget),
    }).catch(() => null);

    setSending(false);
    if (!response) {
      setError("Envoi impossible. Vérifiez votre connexion et réessayez.");
      return;
    }
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(result.error ?? "Envoi impossible. Réessayez dans quelques instants.");
      return;
    }
    setReference(result.reference);
    formRef.current?.reset();
    setFileNames([]);
  };

  if (reference) {
    return (
      <div className="alert alert-success" role="status">
        <p style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 6px" }}>
          <CheckCircle2 size={18} /> <strong>Demande envoyée</strong>
        </p>
        <p style={{ margin: 0 }}>
          Votre demande est enregistrée sous la référence <strong>{reference}</strong>. Un e-mail de
          confirmation vient de vous être envoyé, puis un message à chaque changement de statut.
        </p>
        <button
          type="button"
          className="button button-ghost"
          style={{ marginTop: 14 }}
          onClick={() => setReference("")}
        >
          Envoyer une autre demande
        </button>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={submit} className="settings-form">
      {error && <div className="alert alert-danger" role="alert">{error}</div>}

      <label>
        Société <span aria-hidden="true">*</span>
        <input name="company" required maxLength={160} autoComplete="organization" />
      </label>
      <label>
        Votre nom <span aria-hidden="true">*</span>
        <input name="contact" required maxLength={160} autoComplete="name" />
      </label>
      <label>
        E-mail <span aria-hidden="true">*</span>
        <input name="contactEmail" type="email" required maxLength={200} autoComplete="email" />
        <small>C’est à cette adresse que le suivi de la demande sera envoyé.</small>
      </label>
      <label>
        Téléphone
        <input name="phone" type="tel" maxLength={40} autoComplete="tel" />
      </label>
      <label>
        Adresse de l’intervention
        <input name="address" maxLength={300} autoComplete="street-address" />
      </label>
      <label>
        Équipement concerné
        <input name="equipment" maxLength={200} placeholder="Ex. pompe à chaleur Daikin Altherma" />
      </label>
      <label>
        Objet de la demande <span aria-hidden="true">*</span>
        <input name="title" required maxLength={200} placeholder="Ex. Pompe à chaleur en défaut" />
      </label>
      <label>
        Description du problème <span aria-hidden="true">*</span>
        <textarea name="description" required rows={5} maxLength={4000} />
      </label>

      <label>
        Photos ou documents
        <input
          name="attachments"
          type="file"
          multiple
          accept="image/*,application/pdf,.pdf,.heic,.heif"
          onChange={(event) =>
            setFileNames(Array.from(event.currentTarget.files ?? []).map((file) => file.name))}
        />
        <small>
          Facultatif — jusqu’à {MAX_FILES} fichiers (images ou PDF, 15 Mo chacun). Une photo du
          message d’erreur nous aide beaucoup.
        </small>
      </label>
      {fileNames.length > 0 && (
        <p style={{ display: "flex", alignItems: "center", gap: 6, margin: 0, fontSize: 13 }}>
          <Paperclip size={15} /> {fileNames.length} fichier{fileNames.length > 1 ? "s" : ""} :{" "}
          {fileNames.join(", ")}
        </p>
      )}

      <div className="settings-actions">
        <button className="button button-primary" disabled={sending}>
          <Send size={16} /> {sending ? "Envoi…" : "Envoyer la demande"}
        </button>
      </div>
    </form>
  );
}
