"use client";

import { createContext, useContext, useMemo } from "react";

/**
 * Informations de session utiles à l'interface mobile, fournies une fois par le layout (côté
 * serveur) plutôt que passées en props à travers chaque écran — `MobileTabBar` est rendu par
 * quatre écrans différents, un contexte évite de tout traverser.
 */
export interface MobileSessionValue {
  /** Le compte ne voit que son propre travail (rôle TECHNICIEN). */
  technicianMode: boolean;
  /** Technicien sans `dolibarrUserId` : aucune intervention ne peut lui être rattachée. */
  unlinked: boolean;
  /** ADMIN : peut modifier une intervention depuis le mobile (écrit dans Dolibarr). */
  canEditInterventions: boolean;
}

const MobileSessionContext = createContext<MobileSessionValue>({
  technicianMode: false,
  unlinked: false,
  canEditInterventions: false,
});

export function MobileSessionProvider({
  technicianMode,
  unlinked,
  canEditInterventions,
  children,
}: MobileSessionValue & { children: React.ReactNode }) {
  const value = useMemo(
    () => ({ technicianMode, unlinked, canEditInterventions }),
    [technicianMode, unlinked, canEditInterventions],
  );
  return <MobileSessionContext value={value}>{children}</MobileSessionContext>;
}

export function useMobileSession() {
  return useContext(MobileSessionContext);
}
