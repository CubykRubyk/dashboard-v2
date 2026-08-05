"use client";

import { AlertTriangle } from "lucide-react";

import { useT } from "./MobilePreferences";
import { useMobileSession } from "./MobileSession";
import styles from "./mobile.module.css";

/**
 * Bandeau affiché à un technicien dont le compte n'a pas d'identifiant Dolibarr : aucune
 * intervention ne peut lui être rattachée, ses listes sont donc vides. Sans ce message, l'écran
 * ressemble à « rien de prévu aujourd'hui » alors qu'il s'agit d'une configuration incomplète —
 * exactement le genre de confusion qui finit en appel téléphonique.
 */
export function UnlinkedAccountNotice() {
  const { unlinked } = useMobileSession();
  const t = useT();
  if (!unlinked) return null;

  return (
    <div className={styles.noticeWarning} role="status">
      <AlertTriangle aria-hidden size={17} />
      <div>
        <strong>{t("unlinked.title")}</strong>
        <p>{t("unlinked.body")}</p>
      </div>
    </div>
  );
}
