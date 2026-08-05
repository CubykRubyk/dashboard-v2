"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, FileText, Paperclip, Trash2, Upload } from "lucide-react";

import styles from "./SavAttachments.module.css";

interface Attachment {
  id: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  /** `null` = pièce déposée par le client via le formulaire public. */
  uploadedBy: string | null;
}

function formatSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.round(bytes / 1024)} Ko`
    : `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

// HEIC/HEIF : produit par défaut par l'appareil photo iPhone. Seul Safari sait l'afficher dans une
// balise <img> — ailleurs, autant présenter directement la ligne « fichier » que laisser une
// vignette cassée (même compromis que la galerie des fiches de chantier).
const PREVIEWABLE = new Set(["image/jpeg", "image/png", "image/webp"]);

export function SavAttachments({
  savId,
  canManage,
}: {
  savId: string;
  canManage: boolean;
}) {
  const [attachments, setAttachments] = useState<Attachment[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Chargement initial dans un `.then` plutôt que via une fonction async appelée directement :
  // c'est le tour de main déjà utilisé par `PhotoGallery.tsx`, le seul que la règle
  // `react-hooks/set-state-in-effect` accepte (le setState y est un rappel du système externe).
  // Pas de remise à `null` non plus : le drawer étant monté avec `key={selectedItem.id}`, il est
  // recréé — état initial compris — à chaque changement de SAV.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/sav/${savId}/attachments`)
      .then((response) => (response.ok ? response.json() : { attachments: [] }))
      .then((data) => {
        if (!cancelled) setAttachments(data.attachments ?? []);
      })
      .catch(() => {
        if (!cancelled) setAttachments([]);
      });
    return () => {
      cancelled = true;
    };
  }, [savId]);

  /** Rechargement après un ajout ou une suppression (hors effet, donc sans contrainte). */
  const load = useCallback(async () => {
    const response = await fetch(`/api/sav/${savId}/attachments`).catch(() => null);
    setAttachments(response?.ok ? (await response.json()).attachments : []);
  }, [savId]);

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError("");
    for (const file of Array.from(files)) {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch(`/api/sav/${savId}/attachments`, { method: "POST", body })
        .catch(() => null);
      if (!response?.ok) {
        const result = await response?.json().catch(() => ({}));
        setError(result?.error ?? "Envoi impossible.");
        break;
      }
    }
    setBusy(false);
    await load();
  };

  const remove = async (attachmentId: string) => {
    setBusy(true);
    await fetch(`/api/sav/${savId}/attachments/${attachmentId}`, { method: "DELETE" })
      .catch(() => null);
    setBusy(false);
    await load();
  };

  const images = (attachments ?? []).filter((item) => PREVIEWABLE.has(item.mimeType));
  const files = (attachments ?? []).filter((item) => !PREVIEWABLE.has(item.mimeType));

  return (
    <div className={styles.wrap}>
      {error && <p className={styles.error}>{error}</p>}

      {attachments === null && <p className={styles.empty}>Chargement…</p>}
      {attachments?.length === 0 && <p className={styles.empty}>Aucune pièce jointe.</p>}

      {images.length > 0 && (
        <div className={styles.grid}>
          {images.map((image) => (
            <a
              key={image.id}
              className={styles.thumb}
              href={`/api/sav/${savId}/attachments/${image.id}`}
              target="_blank"
              rel="noreferrer"
              title={image.originalFileName}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/sav/${savId}/attachments/${image.id}`} alt={image.originalFileName} />
              {canManage && (
                <button
                  type="button"
                  className={styles.thumbDelete}
                  disabled={busy}
                  aria-label={`Supprimer ${image.originalFileName}`}
                  onClick={(event) => {
                    event.preventDefault();
                    void remove(image.id);
                  }}
                >
                  <Trash2 aria-hidden size={13} />
                </button>
              )}
            </a>
          ))}
        </div>
      )}

      {files.map((file) => (
        <div key={file.id} className={styles.fileRow}>
          <FileText aria-hidden size={16} />
          <div className={styles.fileMeta}>
            <span className={styles.fileName}>{file.originalFileName}</span>
            <span className={styles.fileSize}>
              {formatSize(file.sizeBytes)}
              {file.uploadedBy ? ` · ${file.uploadedBy}` : " · envoyé par le client"}
            </span>
          </div>
          <a
            className={styles.fileAction}
            href={`/api/sav/${savId}/attachments/${file.id}?download=1`}
            aria-label={`Télécharger ${file.originalFileName}`}
          >
            <Download aria-hidden size={15} />
          </a>
          {canManage && (
            <button
              type="button"
              className={styles.fileAction}
              disabled={busy}
              aria-label={`Supprimer ${file.originalFileName}`}
              onClick={() => void remove(file.id)}
            >
              <Trash2 aria-hidden size={15} />
            </button>
          )}
        </div>
      ))}

      {canManage && (
        <label className={styles.uploadButton}>
          {busy ? <Paperclip aria-hidden size={15} /> : <Upload aria-hidden size={15} />}
          <span>{busy ? "Envoi…" : "Ajouter un fichier"}</span>
          <input
            type="file"
            multiple
            accept="image/*,application/pdf,.pdf,.heic,.heif"
            disabled={busy}
            onChange={(event) => {
              void upload(event.currentTarget.files);
              event.currentTarget.value = "";
            }}
          />
        </label>
      )}
    </div>
  );
}
