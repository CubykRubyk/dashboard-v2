"use client";

import { useEffect, useRef, useState } from "react";

export function DismissibleDetails({
  summary,
  summaryClassName,
  className,
  children,
}: {
  summary: React.ReactNode;
  summaryClassName?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const close = () => {
      if (detailsRef.current) detailsRef.current.open = false;
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (!detailsRef.current?.contains(event.target as Node)) close();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <details
      ref={detailsRef}
      className={className}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className={summaryClassName}>{summary}</summary>
      {children}
    </details>
  );
}
