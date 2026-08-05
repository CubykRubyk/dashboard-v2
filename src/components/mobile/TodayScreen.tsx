"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarOff, ChevronLeft, ChevronRight } from "lucide-react";
import { useMobilePreferences } from "./MobilePreferences";
import { MobileTabBar } from "./MobileTabBar";
import { UnlinkedAccountNotice } from "./UnlinkedAccountNotice";
import { PullToRefresh } from "./PullToRefresh";
import { useDolibarrSync } from "./useDolibarrSync";
import { isOngoingOn, type PlanningItem } from "@/components/planification-sav/mock-data";
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

// Uniquement des interventions ici (voir mobile/page.tsx) — les SAV ont leur propre onglet, pour
// éviter qu'un même dossier (intervention Dolibarr + SAV créé depuis elle) apparaisse deux fois.
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
  const { triggerSync } = useDolibarrSync();
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

  // Une intervention multi-jours (`date`→`endDate`) doit apparaître sur chaque jour de son
  // intervalle, pas seulement sur son premier jour — sinon elle "disparaît" dès le lendemain.
  const countForDay = useMemo(() => {
    const counts = new Map<string, number>();
    for (const iso of weekDays) {
      counts.set(iso, items.filter((item) => isOngoingOn(item, iso)).length);
    }
    return counts;
  }, [items, weekDays]);

  const dayInterventions = items
    .filter((item) => isOngoingOn(item, selectedIso))
    .slice()
    .sort((a, b) => (a.time || "99").localeCompare(b.time || "99"));

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
              <ChevronLeft aria-hidden size={21} />
            </button>
            <button type="button" onClick={() => shiftWeek(1)} aria-label="Semaine suivante">
              <ChevronRight aria-hidden size={21} />
            </button>
          </div>
        </div>
        <p className={styles.topStats}>
          <b>{dayInterventions.length}</b> {t("today.stats.interventions")}
        </p>
      </header>

      <div className={styles.weekStrip} role="group" aria-label={t("calendar.title")}>
        {weekDays.map((iso) => {
          const count = countForDay.get(iso) ?? 0;
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

      <UnlinkedAccountNotice />

      <PullToRefresh className={styles.pageEnter} key={selectedIso} onRefresh={triggerSync}>
        {dayInterventions.length === 0 && (
          <div className={styles.empty}>
            <CalendarOff aria-hidden size={30} />
            <strong>{t("today.empty")}</strong>
            <p>{t("today.emptyHint")}</p>
          </div>
        )}
        {dayInterventions.map((item, index) => (
          <ItemRow key={item.id} item={item} index={index} viewIso={selectedIso} />
        ))}
      </PullToRefresh>

      <MobileTabBar />
    </>
  );
}

export function ItemRow({
  item,
  index,
  viewIso,
}: {
  item: PlanningItem;
  index: number;
  // Jour affiché (liste filtrée par jour) — sert uniquement à détecter une intervention multi-jours
  // qui continue ce jour-là sans y avoir commencé, pour afficher le badge "Suite".
  viewIso?: string;
}) {
  const { t } = useMobilePreferences();
  // Couleur de l'équipe telle qu'elle vient de Dolibarr (`item.color`), comme sur le calendrier
  // desktop ; à défaut, orange pour un SAV et bleu pour une intervention.
  const accent = item.color || (item.kind === "sav" ? "var(--m-orange)" : "var(--primary)");
  const urgent = item.kind === "sav" && item.priority === "Urgente";
  const isContinuation = Boolean(viewIso && item.date && item.date !== viewIso);
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
      {isContinuation && <span className={styles.continuationBadge}>{t("common.continuation")}</span>}
      {urgent && <span className={`${styles.statusPill} ${styles.statusUrgent}`}>{item.priority}</span>}
      <ChevronRight aria-hidden size={17} className={styles.rowChevron} />
    </Link>
  );
}
