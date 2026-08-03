"use client";

import { useEffect, type RefObject } from "react";

// Ferme un popover/menu au clic en dehors de son conteneur ou à l'appui sur Échap — tiré du
// pattern déjà utilisé par GxonDropdown/NotificationBell, généralisé pour éviter la duplication.
export function useClickOutside(ref: RefObject<HTMLElement | null>, onOutside: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) onOutside();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOutside();
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [active, ref, onOutside]);
}
