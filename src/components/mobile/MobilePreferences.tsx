"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  DICTIONARIES,
  isLocale,
  type Locale,
  type TranslationKey,
} from "./i18n/dictionaries";

export type ThemePreference = "light" | "dark" | "auto";

// Même mécanisme que `AppChrome.tsx` côté desktop (attribut `data-theme` sur <html> + clé `theme`
// dans localStorage) — volontairement partagé, pour qu'un aller-retour desktop ↔ mobile garde la
// même apparence au lieu d'avoir deux préférences concurrentes.
const THEME_KEY = "theme";
const LOCALE_KEY = "mobile-locale";

// Couleur de la barre de statut / Dynamic Island — `<meta name="theme-color">` est statique par
// défaut (fixée une fois dans layout.tsx) ; sans mise à jour ici, elle restait sur sa valeur claire
// même en thème sombre, laissant une bande blanche visible en haut de l'écran ("nu arata frumos
// cind e dark theme activata"). Mêmes hex que `--background` clair/sombre dans globals.css.
const STATUS_BAR_COLOR = { light: "#f9f9f9", dark: "#26283e" } as const;

function applyTheme(preference: ThemePreference) {
  const resolved =
    preference === "auto"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : preference;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", STATUS_BAR_COLOR[resolved]);
}

interface PreferencesValue {
  theme: ThemePreference;
  setTheme: (value: ThemePreference) => void;
  locale: Locale;
  setLocale: (value: Locale) => void;
  t: (key: TranslationKey) => string;
}

const PreferencesContext = createContext<PreferencesValue | null>(null);

export function MobilePreferencesProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>("auto");
  const [locale, setLocaleState] = useState<Locale>("fr");

  useEffect(() => {
    const savedTheme = (localStorage.getItem(THEME_KEY) || "auto") as ThemePreference;
    const savedLocale = localStorage.getItem(LOCALE_KEY);
    applyTheme(savedTheme);
    const frame = requestAnimationFrame(() => {
      setThemeState(savedTheme);
      if (isLocale(savedLocale)) setLocaleState(savedLocale);
    });

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncAuto = () => {
      if ((localStorage.getItem(THEME_KEY) || "auto") === "auto") applyTheme("auto");
    };
    media.addEventListener("change", syncAuto);
    return () => {
      cancelAnimationFrame(frame);
      media.removeEventListener("change", syncAuto);
    };
  }, []);

  const setTheme = useCallback((value: ThemePreference) => {
    setThemeState(value);
    localStorage.setItem(THEME_KEY, value);
    applyTheme(value);
  }, []);

  const setLocale = useCallback((value: Locale) => {
    setLocaleState(value);
    localStorage.setItem(LOCALE_KEY, value);
  }, []);

  const t = useCallback((key: TranslationKey) => DICTIONARIES[locale][key] ?? DICTIONARIES.fr[key], [locale]);

  return (
    <PreferencesContext.Provider value={{ theme, setTheme, locale, setLocale, t }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function useMobilePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error("useMobilePreferences doit être utilisé dans MobilePreferencesProvider.");
  return context;
}

export function useT() {
  return useMobilePreferences().t;
}
