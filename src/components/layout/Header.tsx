"use client";

import { useRef, useState } from "react";
import { ChevronDown, KeyRound, LogOut, Monitor, Moon, Search, Sun } from "lucide-react";
import type { SessionUser } from "@/lib/auth/session";
import { logout } from "@/app/(auth)/login/actions";
import { changeOwnPassword } from "@/app/(dashboard)/settings/actions";
import { GxonModal } from "@/components/ui/GxonModal";
import { useClickOutside } from "@/lib/hooks/useClickOutside";
import { NotificationBell } from "./NotificationBell";

type ThemePreference = "light" | "dark" | "auto";

export function Header({
  user,
  theme,
  onThemeChange,
  onToggleSidebar,
  onOpenMobile,
  onOpenSearch,
}: {
  user: SessionUser;
  theme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
  onToggleSidebar: () => void;
  onOpenMobile: () => void;
  onOpenSearch: () => void;
}) {
  const [themeOpen, setThemeOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const themeMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  useClickOutside(themeMenuRef, () => setThemeOpen(false), themeOpen);
  useClickOutside(userMenuRef, () => setUserOpen(false), userOpen);
  const ThemeIcon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;

  return (
    <header className="app-header">
      <button
        className="app-toggler"
        aria-label="Afficher ou réduire le menu"
        data-tooltip="Afficher ou réduire le menu"
        data-tooltip-placement="bottom"
        onClick={() => {
          if (window.matchMedia("(max-width: 1199px)").matches) onOpenMobile();
          else onToggleSidebar();
        }}
      >
        <span />
        <span />
        <span />
      </button>
      <button type="button" className="header-search" onClick={onOpenSearch}>
        <Search aria-hidden size={17} />
        <span>Rechercher...</span>
        <kbd>⌘ K</kbd>
      </button>
      <div className="header-actions">
        <NotificationBell />
        <div className="theme-menu" ref={themeMenuRef}>
          <button
            className="icon-button"
            aria-label="Changer le thème"
            data-tooltip="Changer le thème"
            data-tooltip-placement="bottom"
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
        <div className="user-menu" ref={userMenuRef}>
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
              <GxonModal
                trigger={<><KeyRound aria-hidden size={16} /> Changer le mot de passe</>}
                title="Changer le mot de passe"
              >
                <form action={changeOwnPassword} className="issuer-form">
                  <label>Mot de passe actuel<input name="currentPassword" type="password" required /></label>
                  <label>Nouveau mot de passe<input name="newPassword" type="password" required minLength={12} placeholder="12 caractères minimum" /></label>
                  <label>Confirmer le nouveau mot de passe<input name="confirmPassword" type="password" required minLength={12} /></label>
                  <button className="button button-primary">Enregistrer</button>
                </form>
              </GxonModal>
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
