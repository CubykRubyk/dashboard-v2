"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, CalendarDays, HardHat, LayoutList, Sun, UserRound } from "lucide-react";
import { useT } from "./MobilePreferences";
import { useMobileSession } from "./MobileSession";
import type { TranslationKey } from "./i18n/dictionaries";
import styles from "./mobile.module.css";

const ADMIN_TABS = [
  { href: "/mobile", icon: Sun, label: "tab.today" satisfies TranslationKey },
  { href: "/mobile/sav", icon: LayoutList, label: "tab.sav" satisfies TranslationKey },
  { href: "/mobile/agenda", icon: CalendarDays, label: "tab.calendar" satisfies TranslationKey },
  { href: "/mobile/bibliotheque", icon: BookOpen, label: "tab.library" satisfies TranslationKey },
  { href: "/mobile/profil", icon: UserRound, label: "tab.profile" satisfies TranslationKey },
] as const;

// Un technicien n'a pas accès aux SAV (décision explicite d'Ion : le SAV reste de la gestion
// interne, et une fois planifié il lui revient de toute façon sous forme d'intervention). L'onglet
// est remplacé par la liste de ses chantiers réalisés, pas simplement retiré — la barre garderait
// sinon un vide et quatre onglets valent mieux que trois pour la répartition de l'indicateur.
const TECHNICIAN_TABS = [
  { href: "/mobile", icon: Sun, label: "tab.today" satisfies TranslationKey },
  { href: "/mobile/chantiers", icon: HardHat, label: "tab.worksites" satisfies TranslationKey },
  { href: "/mobile/agenda", icon: CalendarDays, label: "tab.calendar" satisfies TranslationKey },
  { href: "/mobile/bibliotheque", icon: BookOpen, label: "tab.library" satisfies TranslationKey },
  { href: "/mobile/profil", icon: UserRound, label: "tab.profile" satisfies TranslationKey },
] as const;

export function MobileTabBar() {
  const pathname = usePathname();
  const t = useT();
  const { technicianMode } = useMobileSession();
  const TABS = technicianMode ? TECHNICIAN_TABS : ADMIN_TABS;
  const activeIndex = TABS.reduce(
    (best, tab, index) => (pathname === tab.href || pathname.startsWith(`${tab.href}/`) ? index : best),
    0,
  );

  return (
    <nav
      className={styles.tabBar}
      style={{ "--tab-index": activeIndex, "--tab-count": TABS.length } as React.CSSProperties}
      aria-label="Navigation"
    >
      <span className={styles.tabIndicator} aria-hidden />
      {TABS.map((tab, index) => {
        const Icon = tab.icon;
        const active = index === activeIndex;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`${styles.tab}${active ? ` ${styles.tabActive}` : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <Icon aria-hidden size={21} strokeWidth={active ? 2.4 : 1.9} />
            {t(tab.label)}
          </Link>
        );
      })}
    </nav>
  );
}
