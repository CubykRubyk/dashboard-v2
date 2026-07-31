"use client";

import { useState } from "react";
import { Menu, Monitor, Moon, PanelLeftClose, Sun } from "lucide-react";
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
  const ThemeIcon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;

  return (
    <header className="app-header">
      <button className="icon-button sidebar-toggle desktop-only" aria-label="Réduire le menu" onClick={onToggleSidebar}>
        <PanelLeftClose aria-hidden size={19} />
      </button>
      <button className="icon-button sidebar-toggle mobile-only" aria-label="Ouvrir le menu" onClick={onOpenMobile}>
        <Menu aria-hidden size={20} />
      </button>
      {/* La recherche sera réactivée avec le module de recherche globale. */}
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
        <div className="user-summary">
          <span className="user-avatar">{user.name.slice(0, 1).toUpperCase()}</span>
          <span>
            <strong>{user.name}</strong>
            <small>{user.role === "ADMIN" ? "Administrateur" : user.role}</small>
          </span>
        </div>
        <form action={logout}>
          <button className="button button-ghost button-small">Déconnexion</button>
        </form>
      </div>
    </header>
  );
}
