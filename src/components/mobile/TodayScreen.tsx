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

// Lundi de la semaine contenant `iso` (semaine française : lundi → dimanche).
function mondayOf(iso: string) {
  const date = new Date(`${iso}T12:00:00Z`);
  const weekday = (date.getUTCDay() + 6) % 7;
  return addDaysIso(iso, -weekday);
}

export function TodayScreen({
  items,
  todayIso,
  companyName,
}: {
  items: PlanningItem[];
  todayIso: string;
  companyName: string;
}) {
  const { t, locale } = useMobilePreferences();
  const [selectedIso, setSelectedIso] = useState(todayIso);
  const [weekStart, setWeekStart] = useState(() => mondayOf(todayIso));

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, offset) => addDaysIso(weekStart, offset)),
    [weekStart],
  );

  const shiftWeek = (weeks: number) => {
    const nextStart = addDaysIso(weekStart, weeks * 7);
    setWeekStart(nextStart);
    setSelectedIso(nextStart);
  };

  // Les SAV ouverts restent visibles quel que soit le jour choisi (ils sont "à traiter", pas datés) ;
  // les interventions, elles, appartiennent à une date précise.
  const openSav = useMemo(
    () => items.filter((item) => item.kind === "sav" && item.status !== "Clôturé"),
    [items],
  );
  const interventionsByDay = useMemo(() => {
    const map = new Map<string, PlanningItem[]>();
    for (const item of items) {
      if (item.kind !== "intervention") continue;
      const list = map.get(item.date);
      if (list) list.push(item);
      else map.set(item.date, [item]);
    }
    return map;
  }, [items]);

  const dayInterventions = (interventionsByDay.get(selectedIso) ?? []).slice().sort((a, b) =>
    (a.time || "99").localeCompare(b.time || "99"),
  );
  const showSav = selectedIso === todayIso;
  const visible = showSav ? [...dayInterventions, ...openSav] : dayInterventions;

  const dayFormatter = new Intl.DateTimeFormat(LOCALE_TAGS[locale], { weekday: "short" });
  const titleFormatter = new Intl.DateTimeFormat(LOCALE_TAGS[locale], { weekday: "long", day: "numeric", month: "long" });

  const initials = companyName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";

  return (
    <>
      <header className={styles.topBar}>
        <div className={styles.brandRow}>
          <span className={styles.brandMark}>{initials}</span>
          <span className={styles.brandName}>{companyName}</span>
        </div>
        <div className={styles.topRow}>
          <h1 className={styles.topTitle}>
            {selectedIso === todayIso ? t("today.title") : titleFormatter.format(new Date(`${selectedIso}T12:00:00`))}
          </h1>
          <div className={styles.weekNav}>
            <button type="button" onClick={() => shiftWeek(-1)} aria-label="Semaine précédente">
              <ChevronLeft aria-hidden size={18} />
            </button>
            <button type="button" onClick={() => shiftWeek(1)} aria-label="Semaine suivante">
              <ChevronRight aria-hidden size={18} />
            </button>
          </div>
        </div>
        <p className={styles.topStats}>
          <b>{dayInterventions.length}</b> {t("today.stats.interventions")}
          {showSav && (
            <>
              {" · "}
              <b>{openSav.length}</b> {t("today.stats.openSav")}
            </>
          )}
        </p>
      </header>

      <div className={styles.weekStrip} role="group" aria-label={t("calendar.title")}>
        {weekDays.map((iso) => {
          const count = (interventionsByDay.get(iso) ?? []).length;
          const isSelected = iso === selectedIso;
          const isToday = iso === todayIso;
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
              <span className={styles.weekDayName}>
                {dayFormatter.format(new Date(`${iso}T12:00:00`)).replace(".", "")}
              </span>
              <span className={styles.weekDayNumber}>{Number(iso.slice(8, 10))}</span>
              <span className={count > 0 ? styles.weekDayDot : styles.weekDayDotEmpty} />
            </button>
          );
        })}
      </div>

      <PullToRefresh className={styles.pageEnter} key={selectedIso}>
        {visible.length === 0 && (
          <div className={styles.empty}>
            <CalendarOff aria-hidden size={30} />
            <strong>{t("today.empty")}</strong>
            <p>{t("today.emptyHint")}</p>
          </div>
        )}

        {dayInterventions.length > 0 && <p className={styles.sectionLabel}>{t("today.section.interventions")}</p>}
        {dayInterventions.map((item, index) => (
          <ItemRow key={item.id} item={item} index={index} />
        ))}

        {showSav && openSav.length > 0 && <p className={styles.sectionLabel}>{t("today.section.openSav")}</p>}
        {showSav &&
          openSav.map((item, index) => (
            <ItemRow key={item.id} item={item} index={dayInterventions.length + index} />
          ))}
      </PullToRefresh>

      <MobileTabBar />
    </>
  );
}

export function ItemRow({ item, index }: { item: PlanningItem; index: number }) {
  // Couleur de l'équipe telle qu'elle vient de Dolibarr (`item.color`), comme sur le calendrier
  // desktop ; à défaut, orange pour un SAV et bleu pour une intervention.
  const accent = item.color || (item.kind === "sav" ? "var(--m-orange)" : "var(--primary)");
  const urgent = item.kind === "sav" && item.priority === "Urgente";
  return (
    <Link
      href={`/mobile/item/${item.id}`}
      className={`${styles.row} ${styles.stagger}`}
      style={{ "--row-accent": accent, "--i": Math.min(index, 12) } as React.CSSProperties}
    >
      <span className={styles.rowTime}>
        {item.time || "—"}
        {item.time && item.duration && <small>{item.duration}</small>}
      </span>
      <span className={styles.rowMain}>
        <strong>{item.title}</strong>
        <small>{[item.company, item.team].filter(Boolean).join(" · ")}</small>
      </span>
      {urgent && <span className={`${styles.statusPill} ${styles.statusUrgent}`}>{item.priority}</span>}
      <ChevronRight aria-hidden size={17} className={styles.rowChevron} />
    </Link>
  );
}
