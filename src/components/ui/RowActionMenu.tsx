"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";

export interface RowActionMenuItem {
  key: string;
  label: ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

// Menu d'actions "…" rendu via portail (document.body) avec positionnement `fixed` calculé au clic —
// contrairement à un simple `position: absolute`, ça ne peut pas être tronqué par un ancêtre avec
// `overflow: auto/hidden` (ex. le conteneur de scroll horizontal d'un tableau). Voir CLAUDE.md pour le
// contexte du bug que ça corrige.
export function RowActionMenu({
  items,
  label = "Actions",
  triggerClassName = "rowButton",
  triggerSize = 17,
}: {
  items: RowActionMenuItem[];
  label?: string;
  triggerClassName?: string;
  triggerSize?: number;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; right: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent) {
        if (event.key === "Escape") setOpen(false);
        return;
      }
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const closeOnScroll = () => setOpen(false);

    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    window.addEventListener("scroll", closeOnScroll, true);
    window.addEventListener("resize", closeOnScroll);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
      window.removeEventListener("scroll", closeOnScroll, true);
      window.removeEventListener("resize", closeOnScroll);
    };
  }, [open]);

  const toggle = () => {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    }
    setOpen((current) => !current);
  };

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className={triggerClassName}
        onClick={toggle}
        aria-label={label}
        aria-expanded={open}
      >
        <MoreHorizontal aria-hidden size={triggerSize} />
      </button>
      {open && position && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          className="gx-menu"
          role="menu"
          style={{ position: "fixed", top: position.top, right: position.right }}
        >
          {items.map((item, index) => (
            <div key={item.key}>
              {item.danger && index > 0 && <div className="gx-menu-divider" />}
              <button
                type="button"
                role="menuitem"
                className={`gx-menu-item${item.danger ? " gx-menu-item-danger" : ""}`}
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
              >
                {item.label}
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
