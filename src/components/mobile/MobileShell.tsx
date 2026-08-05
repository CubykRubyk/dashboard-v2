"use client";

import { MobilePreferencesProvider } from "./MobilePreferences";
import { MobileSessionProvider, type MobileSessionValue } from "./MobileSession";
import { MobileSplash } from "./MobileSplash";
import { ServiceWorkerRegistrar } from "./ServiceWorkerRegistrar";
import styles from "./mobile.module.css";

export function MobileShell({
  children,
  technicianMode = false,
  unlinked = false,
  canEditInterventions = false,
}: { children: React.ReactNode } & Partial<MobileSessionValue>) {
  return (
    <MobilePreferencesProvider>
      <MobileSessionProvider
        technicianMode={technicianMode}
        unlinked={unlinked}
        canEditInterventions={canEditInterventions}
      >
      {/* `mobile-shell-root` — classe stable (pas un nom de CSS-module hashé) ciblée depuis
         `globals.css` pour bloquer tout rebond de scroll résiduel sur `<body>`/`<html>`. */}
      <div className={`${styles.shell} mobile-shell-root`}>
        {/* Monté une seule fois par vraie entrée dans l'appli (ce layout n'est pas remonté à la
           navigation entre onglets) — voir MobileSplash.tsx pour le détail. */}
        <MobileSplash />
        <ServiceWorkerRegistrar />
        {/* Fondu d'entrée synchronisé avec le fondu de sortie du splash (`.appReveal` dans
           mobile.module.css) — sans ça, l'appli apparaissait d'un coup dès que le splash devenait
           transparent. */}
        <div className={styles.appReveal}>{children}</div>
      </div>
      </MobileSessionProvider>
    </MobilePreferencesProvider>
  );
}
