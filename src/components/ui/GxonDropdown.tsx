"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export function GxonDropdown({ name, label, value, options, onChange }: { name: string; label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);
  useEffect(() => { const close = (event: MouseEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); }; document.addEventListener("mousedown", close); return () => document.removeEventListener("mousedown", close); }, []);
  return <div className="gx-dropdown-field"><span>{label}</span><div className="gx-dropdown" ref={ref}><input type="hidden" name={name} value={value} /><button type="button" className="gx-dropdown-toggle" aria-expanded={open} onClick={() => setOpen((current) => !current)}><span>{selected?.label || "Toutes"}</span><ChevronDown size={15} /></button>{open && <div className="gx-dropdown-menu" role="listbox">{options.map((option) => <button type="button" role="option" aria-selected={option.value === value} className="gx-dropdown-item" key={option.value} onClick={() => { onChange(option.value); setOpen(false); }}>{option.label}{option.value === value && <Check size={14} />}</button>)}</div>}</div></div>;
}
