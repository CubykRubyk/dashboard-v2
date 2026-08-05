"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Images, Trash2, X } from "lucide-react";
import { useToast } from "@/components/layout/ToastProvider";
import styles from "./PhotoGallery.module.css";

interface PhotoMeta {
  id: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  label: string;
  createdAt: string;
}

function formatSize(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Bouton visible seulement si la fiche a au moins une photo (compté côté serveur, voir
// `fiches/[id]/page.tsx`) — inutile d'afficher une action pour ouvrir une galerie vide.
export function PhotoGalleryButton({ workSheetId, photoCount }: { workSheetId: string; photoCount: number }) {
  const [open, setOpen] = useState(false);
  if (photoCount <= 0) return null;
  return (
    <>
      <button type="button" className="button button-ghost" onClick={() => setOpen(true)}>
        <Images aria-hidden size={17} /> Ouvrir la galerie
      </button>
      {open && <PhotoGallery workSheetId={workSheetId} onClose={() => setOpen(false)} />}
    </>
  );
}

function PhotoGallery({ workSheetId, onClose }: { workSheetId: string; onClose: () => void }) {
  const { showToast } = useToast();
  const [photos, setPhotos] = useState<PhotoMeta[] | null>(null);
  const [current, setCurrent] = useState(0);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [broken, setBroken] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/fiches/${workSheetId}/photos`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setPhotos(data.photos || []);
      })
      .catch(() => {
        if (!cancelled) {
          setPhotos([]);
          showToast("Impossible de charger les photos.", "danger");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [workSheetId, showToast]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const go = useCallback((delta: number) => {
    setCurrent((idx) => {
      if (!photos || photos.length === 0) return idx;
      return (idx + delta + photos.length) % photos.length;
    });
  }, [photos]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") go(-1);
      if (event.key === "ArrowRight") go(1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [go, onClose]);

  useEffect(() => {
    const el = stripRef.current?.querySelector(`[data-idx="${current}"]`);
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [current]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleDelete(target: PhotoMeta) {
    if (!window.confirm(`Supprimer « ${target.originalFileName} » ?`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/fiches/${workSheetId}/photos/${target.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setPhotos((prev) => {
        const next = (prev || []).filter((p) => p.id !== target.id);
        setCurrent((idx) => Math.min(idx, Math.max(next.length - 1, 0)));
        return next;
      });
      showToast("Photo supprimée.", "success");
    } catch {
      showToast("La suppression a échoué.", "danger");
    } finally {
      setDeleting(false);
    }
  }

  const selectedPhotos = (photos || []).filter((p) => selected.has(p.id));
  const selectedSize = selectedPhotos.reduce((sum, p) => sum + p.sizeBytes, 0);

  // Pas de zip côté serveur pour l'instant — chaque photo sélectionnée déclenche son propre
  // téléchargement, légèrement décalé pour que le navigateur ne les bloque pas comme un popup
  // spam.
  function downloadSelection() {
    selectedPhotos.forEach((target, index) => {
      window.setTimeout(() => {
        const link = document.createElement("a");
        link.href = `/api/fiches/${workSheetId}/photos/${target.id}/file?download=1`;
        link.download = target.originalFileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
      }, index * 250);
    });
  }

  const photo = photos && photos.length > 0 ? photos[current] : null;

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="Galerie de photos"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={styles.top}>
        <div className={styles.info}>
          {photos && photos.length > 0 && (
            <span className={styles.counter}>
              {current + 1} / {photos.length}
            </span>
          )}
          {photo && (
            <div className={styles.meta}>
              <strong>{photo.originalFileName}</strong>
              <span>
                {formatSize(photo.sizeBytes)} · ajoutée le {formatDate(photo.createdAt)}
              </span>
            </div>
          )}
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.iconBtn}${selectMode ? ` ${styles.iconBtnActive}` : ""}`}
            onClick={() => setSelectMode((v) => !v)}
            title="Sélectionner des photos"
            aria-label="Sélectionner des photos"
            aria-pressed={selectMode}
          >
            <Images aria-hidden size={16} />
          </button>
          {photo && (
            <a
              className={styles.iconBtn}
              href={`/api/fiches/${workSheetId}/photos/${photo.id}/file?download=1`}
              title="Télécharger"
              aria-label="Télécharger"
              download
            >
              <Download aria-hidden size={16} />
            </a>
          )}
          {photo && (
            <button
              type="button"
              className={`${styles.iconBtn} ${styles.danger}`}
              onClick={() => handleDelete(photo)}
              disabled={deleting}
              title="Supprimer"
              aria-label="Supprimer"
            >
              <Trash2 aria-hidden size={16} />
            </button>
          )}
          <button type="button" className={styles.iconBtn} onClick={onClose} title="Fermer" aria-label="Fermer">
            <X aria-hidden size={16} />
          </button>
        </div>
      </div>

      <div className={styles.stage}>
        {photos && photos.length > 1 && (
          <button type="button" className={`${styles.nav} ${styles.prev}`} onClick={() => go(-1)} aria-label="Précédente">
            <ChevronLeft aria-hidden size={20} />
          </button>
        )}
        <div className={styles.imageWrap}>
          {!photos && <p className={styles.loading}>Chargement…</p>}
          {photos && photos.length === 0 && <p className={styles.loading}>Aucune photo.</p>}
          {photo && !broken.has(photo.id) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={photo.id}
              src={`/api/fiches/${workSheetId}/photos/${photo.id}/file`}
              alt={photo.originalFileName}
              onError={() => setBroken((prev) => new Set(prev).add(photo.id))}
            />
          )}
          {photo && broken.has(photo.id) && (
            <div className={styles.fallback}>
              {/* HEIC/HEIF (format par défaut de la caméra iPhone, seul format ajouté depuis le
                 mobile) ne s'affiche pas nativement dans <img> sur Chrome/Firefox/Edge desktop —
                 seul Safari le fait. Le fichier reste intact sur le disque, juste pas prévisualisable
                 ici ; le téléchargement fonctionne toujours. */}
              <p>Aperçu indisponible pour ce format ({photo.mimeType}).</p>
              <a
                className="button button-primary"
                href={`/api/fiches/${workSheetId}/photos/${photo.id}/file?download=1`}
                download
              >
                <Download aria-hidden size={15} /> Télécharger
              </a>
            </div>
          )}
        </div>
        {photos && photos.length > 1 && (
          <button type="button" className={`${styles.nav} ${styles.next}`} onClick={() => go(1)} aria-label="Suivante">
            <ChevronRight aria-hidden size={20} />
          </button>
        )}
      </div>

      <div className={styles.bottom}>
        {selectMode && (
          <div className={styles.selectBar}>
            <div className={styles.selectLeft}>
              <span>
                {selected.size === 0
                  ? "Aucune photo sélectionnée"
                  : `${selected.size} photo${selected.size > 1 ? "s" : ""} sélectionnée${selected.size > 1 ? "s" : ""}`}
              </span>
              {selected.size > 0 && <span className={styles.selectSize}>· {formatSize(selectedSize)}</span>}
              <button
                type="button"
                className={styles.link}
                onClick={() => setSelected(new Set((photos || []).map((p) => p.id)))}
              >
                Tout sélectionner
              </button>
              <button type="button" className={styles.link} onClick={() => setSelected(new Set())}>
                Aucune
              </button>
            </div>
            <button type="button" className="button button-primary" disabled={selected.size === 0} onClick={downloadSelection}>
              <Download aria-hidden size={15} /> Télécharger la sélection
            </button>
          </div>
        )}
        <div className={styles.strip} ref={stripRef}>
          {(photos || []).map((p, idx) => (
            <button
              key={p.id}
              type="button"
              data-idx={idx}
              className={`${styles.thumb}${idx === current ? ` ${styles.thumbActive}` : ""}${
                selected.has(p.id) ? ` ${styles.thumbSelected}` : ""
              }`}
              onClick={() => (selectMode ? toggleSelect(p.id) : setCurrent(idx))}
              aria-label={p.originalFileName}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/fiches/${workSheetId}/photos/${p.id}/file`}
                alt=""
                onError={(event) => {
                  event.currentTarget.style.visibility = "hidden";
                }}
              />
              {selectMode && <span className={styles.checkDot} aria-hidden />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
