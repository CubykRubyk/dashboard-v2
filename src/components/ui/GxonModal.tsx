"use client";

import { useEffect, useId, useState } from "react";
import { X } from "lucide-react";

export function GxonModal({ trigger, title, description, children }: { trigger: React.ReactNode; title: string; description?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", close);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", close); document.body.style.overflow = previous; };
  }, [open]);
  return <>{<button type="button" className="gx-trigger-reset" onClick={() => setOpen(true)}>{trigger}</button>}{open && <div className="gx-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}><section className="gx-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}><header className="gx-modal-header"><div><h2 id={titleId}>{title}</h2>{description && <p>{description}</p>}</div><button type="button" className="gx-modal-close" onClick={() => setOpen(false)} aria-label="Fermer"><X size={18} /></button></header><div className="gx-modal-body">{children}</div></section></div>}</>;
}
