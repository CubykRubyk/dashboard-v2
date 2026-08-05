"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { useT } from "./MobilePreferences";
import { MobileSheet } from "./MobileSheet";
import styles from "./mobile.module.css";

export interface MobilePickerOption {
  value: string;
  label: string;
}

// Remplace un `<select>` natif — impossible à restyler de façon fiable sur iOS/Android (le système
// impose son propre rendu par-dessus le CSS). À la place : un bouton déclencheur (même gabarit visuel
// que l'ancien `.filterSelect`/`.matSelect`) qui ouvre une feuille glissée depuis le bas, cohérente
// avec le reste du design mobile (cartes arrondies, thème clair/sombre partagé).
export function MobilePicker({
  value,
  options,
  onChange,
  placeholder,
  triggerClassName,
  title,
}: {
  value: string;
  options: MobilePickerOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  triggerClassName?: string;
  title?: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);

  const selected = options.find((option) => option.value === value);

  return (
    <>
      <button
        type="button"
        className={`${styles.pickerTrigger} ${triggerClassName || ""}`}
        onClick={() => setOpen(true)}
      >
        <span className={selected ? undefined : styles.pickerTriggerPlaceholder}>
          {selected ? selected.label : placeholder || t("common.choose")}
        </span>
        <ChevronDown aria-hidden size={16} />
      </button>

      <MobileSheet open={open} onClose={() => setOpen(false)} title={title}>
        <div className={styles.sheetList}>
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                type="button"
                key={option.value}
                className={`${styles.sheetOption}${isSelected ? ` ${styles.sheetOptionActive}` : ""}`}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                {option.label}
                {isSelected && <Check aria-hidden size={16} />}
              </button>
            );
          })}
        </div>
      </MobileSheet>
    </>
  );
}
