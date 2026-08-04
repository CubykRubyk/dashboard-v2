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

function todayIso() {
  return new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" }).format(new Date());
}

// Premier jour de la grille (lundi de la semaine contenant le 1er du mois).
function gridStartOf(year: number, month: number) {
  const first = new Date(Date.UTC(year, month, 1, 12));
  const weekday = (first.getUTCDay() + 6) % 7;
  first.setUTCDate(first.getUTCDate() - weekday);
  return first.toISOString().slice(0, 10);
}

// Vrai calendrier mensuel — pas une répétition de la bande de jours de l'écran "Aujourd'hui".
// Grille 7×6 (façon iOS Calendar), points colorés sous les jours actifs, agenda du jour choisi
// en dessous avec les mêmes blocs pleine largeur que le mockup validé.
export function AgendaScreen({ items }: { items: PlanningItem[] }) {
  const { t, locale } = useMobilePreferences();
  const today = todayIso();
  const [cursor, setCursor] = useState(() => {
    const [y, m] = today.split("-").map(Number);
    return { year: y, month: m - 1 };
  });
  const [selectedIso, setSelectedIso] = useState(today);

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

  const gridDays = useMemo(() => {
    const start = gridStartOf(cursor.year, cursor.month);
    return Array.from({ length: 42 }, (_, offset) => addDaysIso(start, offset));
  }, [cursor]);

  const shiftMonth = (delta: number) => {
    const next = new Date(Date.UTC(cursor.year, cursor.month + delta, 1, 12));
    setCursor({ year: next.getUTCFullYear(), month: next.getUTCMonth() });
    setSelectedIso(next.toISOString().slice(0, 10));
  };

  const dayItems = byDay.get(selectedIso) ?? [];
  const monthFormatter = new Intl.DateTimeFormat(LOCALE_TAGS[locale], { month: "long", year: "numeric" });
  const dayTitleFormatter = new Intl.DateTimeFormat(LOCALE_TAGS[locale], { weekday: "long", day: "numeric", month: "long" });
  const weekdayFormatter = new Intl.DateTimeFormat(LOCALE_TAGS[locale], { weekday: "narrow" });
  const weekdayLabels = Array.from({ length: 7 }, (_, i) => weekdayFormatter.format(new Date(`2026-08-${String(3 + i).padStart(2, "0")}T12:00:00`)));

  return (
    <>
      <header className={styles.topBar}>
        <div className={styles.topRow}>
          <div>
            <p className={styles.topEyebrow}>{t("calendar.subtitle")}</p>
            <h1 className={styles.topTitle} style={{ textTransform: "capitalize" }}>
              {monthFormatter.format(new Date(Date.UTC(cursor.year, cursor.month, 1)))}
            </h1>
          </div>
          <div className={styles.weekNav}>
            <button type="button" onClick={() => shiftMonth(-1)} aria-label="Mois précédent">
              <ChevronLeft aria-hidden size={18} />
            </button>
            <button type="button" onClick={() => shiftMonth(1)} aria-label="Mois suivant">
              <ChevronRight aria-hidden size={18} />
            </button>
          </div>
        </div>
      </header>

      <div className={styles.monthGrid}>
        <div className={styles.monthWeekdays}>
          {weekdayLabels.map((label, i) => (
            <span key={i}>{label}</span>
          ))}
        </div>
        <div className={styles.monthCells}>
          {gridDays.map((iso) => {
            const inMonth = Number(iso.slice(5, 7)) - 1 === cursor.month;
            const dayList = byDay.get(iso) ?? [];
            const isSelected = iso === selectedIso;
            const isToday = iso === today;
            return (
              <button
                key={iso}
                type="button"
                className={`${styles.monthCell}${isSelected ? ` ${styles.monthCellSelected}` : ""}${
                  !isSelected && isToday ? ` ${styles.monthCellToday}` : ""
                }${inMonth ? "" : ` ${styles.monthCellOutside}`}`}
                onClick={() => setSelectedIso(iso)}
                aria-pressed={isSelected}
              >
                <span className={styles.monthCellNumber}>{Number(iso.slice(8, 10))}</span>
                {dayList.length > 0 && (
                  <span className={styles.monthCellDots}>
                    {dayList.slice(0, 3).map((dayItem) => (
                      <i
                        key={dayItem.id}
                        style={{ background: isSelected ? "currentColor" : dayItem.color || "var(--m-orange)" }}
                      />
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <p className={styles.sectionLabel} style={{ textTransform: "capitalize" }}>
        {dayTitleFormatter.format(new Date(`${selectedIso}T12:00:00`))}
      </p>

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
