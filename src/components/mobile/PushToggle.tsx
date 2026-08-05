"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";

import { useT } from "./MobilePreferences";
import styles from "./mobile.module.css";

type State = "loading" | "unsupported" | "not-configured" | "denied" | "off" | "on";

/** Clé VAPID base64url → Uint8Array, format attendu par `PushManager.subscribe`. */
function decodeVapidKey(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

/**
 * Activation des notifications sur cet appareil.
 *
 * Sur iOS, `PushManager` n'existe **que** dans une PWA installée sur l'écran d'accueil
 * (iOS 16.4+) : dans un onglet Safari ordinaire, l'état « non pris en charge » est normal et le
 * message doit le dire, sans quoi Ion croira à une panne.
 */
export function PushToggle() {
  const t = useT();
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);

  // Fonction *pure* du point de vue de React : elle calcule l'état, sans le poser. Le setState
  // n'a lieu que dans le `.then` ci-dessous — seule forme acceptée par la règle
  // `react-hooks/set-state-in-effect` (le même tour de main que dans SavAttachments.tsx).
  const detect = useCallback(async (): Promise<State> => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return "unsupported";

    const config = await fetch("/api/notifications/subscribe")
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null);
    if (!config?.configured || !config.publicKey) return "not-configured";
    if (Notification.permission === "denied") return "denied";

    const registration = await navigator.serviceWorker.getRegistration();
    const existing = await registration?.pushManager.getSubscription();
    return existing ? "on" : "off";
  }, []);

  useEffect(() => {
    let cancelled = false;
    detect()
      .then((next) => {
        if (!cancelled) setState(next);
      })
      .catch(() => {
        if (!cancelled) setState("unsupported");
      });
    return () => {
      cancelled = true;
    };
  }, [detect]);

  const enable = async () => {
    setBusy(true);
    try {
      const config = await fetch("/api/notifications/subscribe").then((r) => r.json());
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeVapidKey(config.publicKey),
      });
      const response = await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      setState(response.ok ? "on" : "off");
    } catch (error) {
      console.error("Abonnement push impossible :", error);
      setState("off");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await fetch(`/api/notifications/subscribe?endpoint=${encodeURIComponent(subscription.endpoint)}`, {
          method: "DELETE",
        });
        await subscription.unsubscribe();
      }
      setState("off");
    } finally {
      setBusy(false);
    }
  };

  if (state === "loading") return null;

  if (state === "unsupported" || state === "not-configured" || state === "denied") {
    return (
      <p className={styles.pushHint}>
        <BellOff aria-hidden size={15} />
        {t(
          state === "denied"
            ? "push.denied"
            : state === "not-configured"
              ? "push.unavailable"
              : "push.unsupported",
        )}
      </p>
    );
  }

  return (
    <button
      type="button"
      className={styles.pushButton}
      disabled={busy}
      onClick={() => (state === "on" ? disable() : enable())}
    >
      {state === "on" ? <Bell aria-hidden size={16} /> : <BellOff aria-hidden size={16} />}
      {t(state === "on" ? "push.enabled" : "push.enable")}
    </button>
  );
}
