"use client";

import { useState } from "react";
import { ChevronDown, LogOut, Monitor, Moon, Search, Sun } from "lucide-react";
import type { SessionUser } from "@/lib/auth/session";
import { logout } from "@/app/(auth)/login/actions";

type ThemePreference = "light" | "dark" | "auto";

export function Header({
  user,
  theme,
  onThemeChange,
  onToggleSidebar,
  onOpenMobile,
}: {
  user: SessionUser;
  theme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
  onToggleSidebar: () => void;
  onOpenMobile: () => void;
}) {
  const [themeOpen, setThemeOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const ThemeIcon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;

  return (
    <header className="app-header">
      <button
        className="app-toggler"
        aria-label="Afficher ou réduire le menu"
        onClick={() => {
          if (window.matchMedia("(max-width: 1199px)").matches) onOpenMobile();
          else onToggleSidebar();
        }}
      >
        <span />
        <span />
        <span />
      </button>
      <div className="header-search" aria-label="Recherche bientôt disponible">
        <Search aria-hidden size={17} />
        <span>Rechercher...</span>
        <kbd>⌘ K</kbd>
      </div>
      <div className="header-actions">
        <div className="theme-menu">
          <button
            className="icon-button"
            aria-label="Changer le thème"
            aria-expanded={themeOpen}
            onClick={() => setThemeOpen((open) => !open)}
          >
            <ThemeIcon aria-hidden size={19} />
          </button>
          {themeOpen && (
            <div className="theme-popover">
              <button className={theme === "light" ? "selected" : ""} onClick={() => { onThemeChange("light"); setThemeOpen(false); }}>
                <Sun size={17} /> Clair
              </button>
              <button className={theme === "dark" ? "selected" : ""} onClick={() => { onThemeChange("dark"); setThemeOpen(false); }}>
                <Moon size={17} /> Sombre
              </button>
              <button className={theme === "auto" ? "selected" : ""} onClick={() => { onThemeChange("auto"); setThemeOpen(false); }}>
                <Monitor size={17} /> Automatique
              </button>
            </div>
          )}
        </div>
        <div className="user-menu">
          <button
            className="user-summary"
            aria-expanded={userOpen}
            onClick={() => setUserOpen((open) => !open)}
          >
            <span className="user-avatar">{user.name.slice(0, 1).toUpperCase()}</span>
            <span className="user-copy">
              <strong>{user.name}</strong>
              <small>{user.role === "ADMIN" ? "Administrateur" : user.role}</small>
            </span>
            <ChevronDown aria-hidden size={14} />
          </button>
          {userOpen && (
            <div className="user-popover">
              <div>
                <strong>{user.name}</strong>
                <small>{user.email}</small>
              </div>
              <form action={logout}>
                <button>
                  <LogOut aria-hidden size={16} />
                  Déconnexion
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
