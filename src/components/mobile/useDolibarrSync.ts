"use client";

import { useCallback, useState } from "react";

type SyncResult = { ok: true } | { ok: false; message: string };

// Déclenche une vraie resynchronisation Dolibarr (POST /api/planification-sav/sync, le même
// endpoint que le bouton "Resincronizare manuală" du desktop) — sans ça, un utilisateur qui ne fait
// que du mobile ne voit jamais les changements Dolibarr tant que personne n'ouvre le desktop
// (auto-sync desktop gated à 1h, voir CLAUDE.md). Gate serveur `canManageSav` (ADMIN/OPERATOR) —
// un compte VIEWER reçoit une erreur explicite (`message`), pas un échec silencieux.
export function useDolibarrSync() {
  const [syncing, setSyncing] = useState(false);

  const triggerSync = useCallback(async (): Promise<SyncResult> => {
    setSyncing(true);
    try {
      const res = await fetch("/api/planification-sav/sync", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { ok: false, message: typeof data.error === "string" ? data.error : "Erreur inconnue." };
      }
      return { ok: true };
    } catch {
      return { ok: false, message: "Connexion impossible." };
    } finally {
      setSyncing(false);
    }
  }, []);

  return { syncing, triggerSync };
}
