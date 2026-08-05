"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import styles from "./mobile.module.css";

const PULL_THRESHOLD = 64;
const MAX_PULL = 96;

// `onRefresh` (optionnel) est attendu avant `router.refresh()` — sert à déclencher une vraie
// resynchronisation Dolibarr (voir useDolibarrSync) avant de redemander les données locales, sinon
// le geste ne relit que ce qui était déjà en base (comportement d'origine, insuffisant pour un
// utilisateur qui ne fait que du mobile — retour d'Ion).
export function PullToRefresh({
  children,
  className,
  onRefresh,
}: {
  children: React.ReactNode;
  className?: string;
  onRefresh?: () => Promise<unknown>;
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef<number | null>(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (event: TouchEvent) => {
      startY.current = el.scrollTop <= 0 && !refreshing ? event.touches[0].clientY : null;
    };
    const onTouchMove = (event: TouchEvent) => {
      if (startY.current === null) return;
      const delta = event.touches[0].clientY - startY.current;
      if (delta <= 0) return;
      setPull(Math.min(delta * 0.5, MAX_PULL));
      if (el.scrollTop <= 0) event.preventDefault();
    };
    const onTouchEnd = () => {
      if (startY.current === null) return;
      startY.current = null;
      setPull((current) => {
        if (current >= PULL_THRESHOLD) {
          setRefreshing(true);
          // Le sync Dolibarr peut prendre plusieurs secondes (voir CLAUDE.md) — le spinner reste
          // actif jusqu'à la fin réelle, pas un délai fixe arbitraire.
          Promise.resolve(onRefresh?.())
            .catch(() => undefined)
            .finally(() => {
              router.refresh();
              setRefreshing(false);
            });
        }
        return 0;
      });
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [refreshing, router, onRefresh]);

  return (
    <div ref={containerRef} className={`${styles.scroll}${className ? ` ${className}` : ""}`}>
      <div
        className={styles.pullIndicator}
        style={{ height: refreshing ? 40 : pull, opacity: refreshing ? 1 : pull / PULL_THRESHOLD }}
      >
        <RefreshCw
          aria-hidden
          size={16}
          className={refreshing ? styles.spin : undefined}
          style={refreshing ? undefined : { transform: `rotate(${pull * 3}deg)` }}
        />
      </div>
      {children}
    </div>
  );
}
