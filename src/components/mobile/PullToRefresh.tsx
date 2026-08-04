"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import styles from "./mobile.module.css";

const PULL_THRESHOLD = 64;
const MAX_PULL = 96;

// Aucun état "réseau" ici — juste `router.refresh()` (relance le server component, redemande les
// données déjà en base). La resynchro Dolibarr elle-même reste dans page.tsx du desktop (voir
// `after()`), en tâche de fond ; ceci ne fait que redemander ce qui est déjà disponible.
export function PullToRefresh({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
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
          router.refresh();
          window.setTimeout(() => setRefreshing(false), 600);
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
  }, [refreshing, router]);

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
