"use client";

import Link from "next/link";
import { LogOut, Monitor, MoonStar, Sun, SunMoon } from "lucide-react";
import { logout } from "@/app/(auth)/login/actions";
import { useMobilePreferences } from "./MobilePreferences";
import { MobileTabBar } from "./MobileTabBar";
import { PushToggle } from "./PushToggle";
import { LOCALE_LABELS, LOCALES } from "./i18n/dictionaries";
import type { ThemePreference } from "./MobilePreferences";
import styles from "./mobile.module.css";

export function ProfileScreen({ name, email, role }: { name: string; email: string; role: string }) {
  const { theme, setTheme, locale, setLocale, t } = useMobilePreferences();

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";

  const themes: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
    { value: "light", label: t("profile.theme.light"), icon: Sun },
    { value: "dark", label: t("profile.theme.dark"), icon: MoonStar },
    { value: "auto", label: t("profile.theme.auto"), icon: SunMoon },
  ];

  return (
    <>
      <div className={`${styles.scroll} ${styles.pageEnter}`}>
        <div className={styles.profileHero}>
          <span className={styles.avatar}>{initials}</span>
          <h1>{name}</h1>
          <p>{email} · {role}</p>
        </div>

        <div className={styles.settingBlock}>
          <small>{t("profile.appearance")}</small>
          <div className={styles.segmented} role="group" aria-label={t("profile.appearance")}>
            {themes.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.value}
                  type="button"
                  className={`${styles.segmentedItem}${theme === option.value ? ` ${styles.segmentedItemActive}` : ""}`}
                  onClick={() => setTheme(option.value)}
                >
                  <Icon aria-hidden size={15} style={{ verticalAlign: "-2px", marginRight: 5 }} />
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className={styles.settingBlock}>
          <small>{t("profile.language")}</small>
          <div className={styles.segmented} role="group" aria-label={t("profile.language")}>
            {LOCALES.map((value) => (
              <button
                key={value}
                type="button"
                className={`${styles.segmentedItem}${locale === value ? ` ${styles.segmentedItemActive}` : ""}`}
                onClick={() => setLocale(value)}
              >
                {LOCALE_LABELS[value]}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.card}>
          <PushToggle />
        </div>

        <div className={styles.card}>
          <Link href="/planification-sav" className={styles.field}>
            <span className={styles.fieldIcon}><Monitor aria-hidden size={15} /></span>
            <span className={styles.fieldBody}>
              <strong>{t("profile.desktop")}</strong>
            </span>
          </Link>
        </div>

        <form action={logout}>
          <div className={styles.card}>
            <button type="submit" className={`${styles.field} ${styles.dangerField}`}>
              <span className={styles.fieldIcon}><LogOut aria-hidden size={15} /></span>
              <span className={styles.fieldBody}>
                <strong>{t("profile.logout")}</strong>
              </span>
            </button>
          </div>
        </form>
      </div>

      <MobileTabBar />
    </>
  );
}
