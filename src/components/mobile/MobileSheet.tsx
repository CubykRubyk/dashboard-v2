"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import styles from "./mobile.module.css";

// Base commune pour toute "feuille" glissée depuis le bas (sélecteur `MobilePicker`, choix
// d'application d'itinéraire...) — portal + verrouillage du scroll + fermeture Échap, factorisés
// une seule fois plutôt que dupliqués à chaque nouvel usage.
export function MobileSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className={styles.sheetOverlay} onClick={onClose}>
      <div className={styles.sheet} role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <span className={styles.sheetHandle} aria-hidden />
        {title && <h2 className={styles.sheetTitle}>{title}</h2>}
        {children}
      </div>
    </div>,
    document.body,
  );
}
