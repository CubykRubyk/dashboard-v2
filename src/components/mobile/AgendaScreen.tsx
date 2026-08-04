"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarOff, ChevronLeft, ChevronRight } from "lucide-react";
import { useMobilePreferences } from "./MobilePreferences";
import { MobileTabBar } from "./MobileTabBar";
import { PullToRefresh } from "./PullToRefresh";
import type { PlanningItem } from "@/components/planification-sav/mock-data";
import styles from "./mobile.module.css";

const LOCALE_TAGS = { fr: "fr-FR", ro: "ro-RO", ru: "ru-RU" } as const;

function addDaysIso(iso: string, days: number) {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function mondayOf(iso: string) {
  const date = new Date(`${iso}T12:00:00Z`);
  const weekday = (date.getUTCDay() + 6) % 7;
  return addDaysIso(iso, -weekday);
}

function todayIso() {
  return new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" }).format(new Date());
}

// Calendrier propre au mobile — pas FullCalendar (trop dense, illisible à cette taille) : une
// semaine défilante en haut, des blocs colorés pleine largeur en dessous, sur le modèle validé
// dans l'artefact ("calendrier full-screen horizontal") plutôt qu'une copie du desktop.
export function AgendaScreen({ items }: { items: PlanningItem[] }) {
  const { t, locale } = useMobilePreferences();
  const [weekStart, setWeekStart] = useState(() => mondayOf(todayIso()));
  const [selectedIso, setSelectedIso] = useState(() => todayIso());
  const today = todayIso();

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, offset) => addDaysIso(weekStart, offset)), [weekStart]);

  const byDay = useMemo(() => {
    const map = new Map<string, PlanningItem[]>();
    for (const item of items) {
      const list = map.get(item.date);
      if (list) list.push(item);
      else map.set(item.date, [item]);
    }
    for (const list of map.values()) list.sort((a, b) => (a.time || "99").localeCompare(b.time || "99"));
    return map;
  }, [items]);

  const dayItems = byDay.get(selectedIso) ?? [];
  const dayFormatter = new Intl.DateTimeFormat(LOCALE_TAGS[locale], { weekday: "short" });
  const titleFormatter = new Intl.DateTimeFormat(LOCALE_TAGS[locale], { weekday: "long", day: "numeric", month: "long" });

  const shiftWeek = (weeks: number) => {
    const nextStart = addDaysIso(weekStart, weeks * 7);
    setWeekStart(nextStart);
    setSelectedIso(nextStart);
  };

  return (
    <>
      <header className={styles.topBar}>
        <div className={styles.topRow}>
          <div>
            <p className={styles.topEyebrow}>{t("calendar.subtitle")}</p>
            <h1 className={styles.topTitle}>{titleFormatter.format(new Date(`${selectedIso}T12:00:00`))}</h1>
          </div>
          <div className={styles.weekNav}>
            <button type="button" onClick={() => shiftWeek(-1)} aria-label="Semaine précédente">
              <ChevronLeft aria-hidden size={18} />
            </button>
            <button type="button" onClick={() => shiftWeek(1)} aria-label="Semaine suivante">
              <ChevronRight aria-hidden size={18} />
            </button>
          </div>
        </div>
      </header>

      <div className={styles.weekStrip} role="group" aria-label={t("calendar.title")}>
        {weekDays.map((iso) => {
          const count = (byDay.get(iso) ?? []).length;
          const isSelected = iso === selectedIso;
          const isToday = iso === today;
          return (
            <button
              key={iso}
              type="button"
              className={`${styles.weekDay}${isSelected ? ` ${styles.weekDayActive}` : ""}${
                !isSelected && isToday ? ` ${styles.weekDayToday}` : ""
              }`}
              onClick={() => setSelectedIso(iso)}
              aria-pressed={isSelected}
            >
              <span className={styles.weekDayName}>{dayFormatter.format(new Date(`${iso}T12:00:00`)).replace(".", "")}</span>
              <span className={styles.weekDayNumber}>{Number(iso.slice(8, 10))}</span>
              <span className={count > 0 ? styles.weekDayDot : styles.weekDayDotEmpty} />
            </button>
          );
        })}
      </div>

      <PullToRefresh className={styles.pageEnter} key={selectedIso}>
        {dayItems.length === 0 && (
          <div className={styles.empty}>
            <CalendarOff aria-hidden size={30} />
            <strong>{t("today.empty")}</strong>
          </div>
        )}
        {dayItems.map((item, index) => {
          const accent = item.color || (item.kind === "sav" ? "var(--m-orange)" : "var(--primary)");
          return (
            <Link
              key={item.id}
              href={`/mobile/item/${item.id}`}
              className={`${styles.agendaBlock} ${styles.stagger}`}
              style={{ "--row-accent": accent, "--i": Math.min(index, 12) } as React.CSSProperties}
            >
              <span className={styles.agendaBlockTime}>{item.time || "—"}</span>
              <span className={styles.agendaBlockMain}>
                <strong>{item.title}</strong>
                <small>{[item.company, item.team].filter(Boolean).join(" · ")}</small>
              </span>
            </Link>
          );
        })}
      </PullToRefresh>

      <MobileTabBar />
    </>
  );
}
