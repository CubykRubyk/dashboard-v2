"use client";

import { useEffect, useSyncExternalStore } from "react";
import { CloudOff } from "lucide-react";

import { useT } from "./MobilePreferences";
import styles from "./mobile.module.css";

/**
 * Enregistre le service worker et signale l'état hors ligne.
 *
 * **Uniquement en production** : en `next dev`, le service worker met en cache des réponses que
 * le rechargement à chaud invalide aussitôt, ce qui donne des symptômes impossibles à
 * diagnostiquer (page figée sur une version antérieure). Le projet a déjà appris à ses dépens
 * qu'il ne faut pas conclure d'un test en dev — voir le diagnostic « rien ne réagit au clic »
 * dans CLAUDE.md. La vérification se fait donc sur un vrai build.
 */
/**
 * `useSyncExternalStore` plutôt qu'un `useState` initialisé dans un effet : l'état en ligne est
 * une source externe au sens de React, et la lire ainsi évite le rendu en cascade que la règle
 * `react-hooks/set-state-in-effect` interdit — tout en donnant la bonne valeur dès le premier
 * rendu client (un `useState(false)` afficherait l'appli comme en ligne le temps d'un rendu).
 */
function subscribeToConnectivity(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

export function ServiceWorkerRegistrar() {
  const t = useT();
  const offline = useSyncExternalStore(
    subscribeToConnectivity,
    () => !navigator.onLine,
    // Rendu serveur : on suppose la connexion présente, sans quoi le HTML contiendrait un bandeau
    // « hors ligne » que l'hydratation devrait aussitôt retirer.
    () => false,
  );

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("Service worker non enregistré :", error);
    });
  }, []);

  if (!offline) return null;
  return (
    <div className={styles.offlineBanner} role="status">
      <CloudOff aria-hidden size={15} />
      {t("offline.banner")}
    </div>
  );
}
