"use client";

import { useEffect, useState } from "react";
import type { SessionUser } from "@/lib/auth/session";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

type ThemePreference = "light" | "dark" | "auto";

function applyTheme(preference: ThemePreference) {
  const resolved =
    preference === "auto"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : preference;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
}

export function AppChrome({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  const [theme, setTheme] = useState<ThemePreference>("auto");
  const [compact, setCompact] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const savedTheme = (localStorage.getItem("theme") || "auto") as ThemePreference;
    const savedSidebar = localStorage.getItem("sidebar") === "compact";
    applyTheme(savedTheme);
    const frame = requestAnimationFrame(() => {
      setTheme(savedTheme);
      setCompact(savedSidebar);
    });

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncAuto = () => {
      if ((localStorage.getItem("theme") || "auto") === "auto") applyTheme("auto");
    };
    media.addEventListener("change", syncAuto);
    return () => {
      cancelAnimationFrame(frame);
      media.removeEventListener("change", syncAuto);
    };
  }, []);

  const changeTheme = (nextTheme: ThemePreference) => {
    setTheme(nextTheme);
    localStorage.setItem("theme", nextTheme);
    applyTheme(nextTheme);
  };

  const toggleCompact = () => {
    setCompact((current) => {
      const next = !current;
      localStorage.setItem("sidebar", next ? "compact" : "full");
      return next;
    });
  };

  return (
    <div className={`app-shell${compact ? " sidebar-compact" : ""}${mobileOpen ? " sidebar-mobile-open" : ""}`}>
      <Sidebar onNavigate={() => setMobileOpen(false)} />
      <button
        className="sidebar-overlay"
        aria-label="Fermer le menu"
        onClick={() => setMobileOpen(false)}
      />
      <div className="app-main">
        <Header
          user={user}
          theme={theme}
          onThemeChange={changeTheme}
          onToggleSidebar={toggleCompact}
          onOpenMobile={() => setMobileOpen(true)}
        />
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}
