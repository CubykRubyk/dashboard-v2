"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarOff, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { useMobilePreferences } from "./MobilePreferences";
import { MobileTabBar } from "./MobileTabBar";
import { UnlinkedAccountNotice } from "./UnlinkedAccountNotice";
import { PullToRefresh } from "./PullToRefresh";
import { useDolibarrSync } from "./useDolibarrSync";
import { isOngoingOn, type PlanningItem } from "@/components/planification-sav/mock-data";
import styles from "./mobile.module.css";

const LOCALE_TAGS = { fr: "fr-FR", ro: "ro-RO", ru: "ru-RU" } as const;

type CalendarView = "week" | "month";

function addDaysIso(iso: string, days: number) {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function todayIso() {
  return new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" }).format(new Date());
}

// Lundi de la semaine contenant `iso` (semaine française : lundi → dimanche) — même logique que
// TodayScreen, dupliquée volontairement (petit helper local, pas de bénéfice à le partager).
function mondayOf(iso: string) {
  const date = new Date(`${iso}T12:00:00Z`);
  const weekday = (date.getUTCDay() + 6) % 7;
  return addDaysIso(iso, -weekday);
}

// Premier jour de la grille mensuelle (lundi de la semaine contenant le 1er du mois).
function gridStartOf(year: number, month: number) {
  const first = new Date(Date.UTC(year, month, 1, 12));
  const weekday = (first.getUTCDay() + 6) % 7;
  first.setUTCDate(first.getUTCDate() - weekday);
  return first.toISOString().slice(0, 10);
}

// Vue "Semaine" — reproduit le calendrier plein écran horizontal du mockup validé (colonnes par
// jour, blocs pleinement colorés comme `PlanningCalendar` desktop), adapté à la largeur d'un
// téléphone en portrait via un scroll horizontal à accroche plutôt que 7 colonnes fixes trop
// étroites. Vue "Mois" — grille classique façon iOS Calendar, gardée pour la vue d'ensemble.
export function AgendaScreen({ items }: { items: PlanningItem[] }) {
  const { t, locale } = useMobilePreferences();
  const router = useRouter();
  const { syncing, triggerSync } = useDolibarrSync();
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);
  const today = todayIso();
  const [view, setView] = useState<CalendarView>("week");
  const [cursor, setCursor] = useState(() => {
    const [y, m] = today.split("-").map(Number);
    return { year: y, month: m - 1 };
  });
  const [weekStart, setWeekStart] = useState(() => mondayOf(today));
  const [selectedIso, setSelectedIso] = useState(today);
  const weekScrollRef = useRef<HTMLDivElement>(null);
  const todayColRef = useRef<HTMLDivElement>(null);

  // Utilisé par le bouton manuel (visible en Semaine et en Mois) et par le pull-to-refresh de la
  // vue Mois (`onRefresh`, voir plus bas) — un seul endroit pour le feedback (toast), que le sync
  // vienne du geste ou du bouton.
  const runSync = async () => {
    const result = await triggerSync();
    setToast(
      result.ok
        ? { text: t("calendar.sync.success") }
        : { text: `${t("calendar.sync.error")} ${result.message}`, error: true },
    );
    window.setTimeout(() => setToast(null), 3000);
    return result;
  };

  const handleManualRefresh = async () => {
    await runSync();
    router.refresh();
  };

  useEffect(() => {
    todayColRef.current?.scrollIntoView({ inline: "start", block: "nearest" });
  }, [weekStart]);

  // Une intervention multi-jours (`date`→`endDate`) doit apparaître sur chaque jour de son
  // intervalle (pastille + agenda du jour), pas seulement sur son premier jour.
  const itemsOnDay = useMemo(() => {
    return (iso: string) =>
      items.filter((item) => isOngoingOn(item, iso)).sort((a, b) => (a.time || "99").localeCompare(b.time || "99"));
  }, [items]);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, offset) => addDaysIso(weekStart, offset)),
    [weekStart],
  );

  const gridDays = useMemo(() => {
    const start = gridStartOf(cursor.year, cursor.month);
    return Array.from({ length: 42 }, (_, offset) => addDaysIso(start, offset));
  }, [cursor]);

  const shiftMonth = (delta: number) => {
    const next = new Date(Date.UTC(cursor.year, cursor.month + delta, 1, 12));
    setCursor({ year: next.getUTCFullYear(), month: next.getUTCMonth() });
    setSelectedIso(next.toISOString().slice(0, 10));
  };

  const shiftWeek = (weeks: number) => setWeekStart((current) => addDaysIso(current, weeks * 7));

  const dayItems = itemsOnDay(selectedIso);
  const monthFormatter = new Intl.DateTimeFormat(LOCALE_TAGS[locale], { month: "long", year: "numeric" });
  const dayTitleFormatter = new Intl.DateTimeFormat(LOCALE_TAGS[locale], { weekday: "long", day: "numeric", month: "long" });
  const weekdayFormatter = new Intl.DateTimeFormat(LOCALE_TAGS[locale], { weekday: "narrow" });
  const weekdayShortFormatter = new Intl.DateTimeFormat(LOCALE_TAGS[locale], { weekday: "short" });
  const weekMonthFormatter = new Intl.DateTimeFormat(LOCALE_TAGS[locale], { month: "short" });
  const weekdayLabels = Array.from({ length: 7 }, (_, i) => weekdayFormatter.format(new Date(`2026-08-${String(3 + i).padStart(2, "0")}T12:00:00`)));

  const weekEnd = weekDays[6];
  const weekRangeLabel = (() => {
    const startDate = new Date(`${weekStart}T12:00:00`);
    const endDate = new Date(`${weekEnd}T12:00:00`);
    const startDay = startDate.getDate();
    const endDay = endDate.getDate();
    const sameMonth = startDate.getMonth() === endDate.getMonth();
    const endLabel = `${endDay} ${weekMonthFormatter.format(endDate)} ${endDate.getFullYear()}`;
    return sameMonth ? `${startDay} – ${endLabel}` : `${startDay} ${weekMonthFormatter.format(startDate)} – ${endLabel}`;
  })();

  return (
    <>
      <header className={styles.topBar}>
        <div className={styles.topRow}>
          <div>
            <p className={styles.topEyebrow}>{t("calendar.subtitle")}</p>
            <h1 className={styles.topTitle} style={{ textTransform: "capitalize" }}>
              {view === "week" ? weekRangeLabel : monthFormatter.format(new Date(Date.UTC(cursor.year, cursor.month, 1)))}
            </h1>
          </div>
          <div className={styles.weekNav}>
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={syncing}
              aria-label={t("calendar.sync.action")}
            >
              <RefreshCw aria-hidden size={18} className={syncing ? styles.spin : undefined} />
            </button>
            <button
              type="button"
              onClick={() => (view === "week" ? shiftWeek(-1) : shiftMonth(-1))}
              aria-label="Précédent"
            >
              <ChevronLeft aria-hidden size={21} />
            </button>
            <button
              type="button"
              onClick={() => (view === "week" ? shiftWeek(1) : shiftMonth(1))}
              aria-label="Suivant"
            >
              <ChevronRight aria-hidden size={21} />
            </button>
          </div>
        </div>
        <div className={styles.segmented} role="group" aria-label={t("calendar.title")} style={{ marginTop: 10 }}>
          <button
            type="button"
            className={`${styles.segmentedItem}${view === "week" ? ` ${styles.segmentedItemActive}` : ""}`}
            onClick={() => setView("week")}
          >
            {t("calendar.view.week")}
          </button>
          <button
            type="button"
            className={`${styles.segmentedItem}${view === "month" ? ` ${styles.segmentedItemActive}` : ""}`}
            onClick={() => setView("month")}
          >
            {t("calendar.view.month")}
          </button>
        </div>
      </header>

      {view === "week" ? (
        <div className={styles.weekScroll} ref={weekScrollRef}>
          {weekDays.map((iso) => {
            const isToday = iso === today;
            const dayList = itemsOnDay(iso);
            const date = new Date(`${iso}T12:00:00`);
            return (
              <div
                key={iso}
                ref={isToday ? todayColRef : undefined}
                className={`${styles.weekCol}${isToday ? ` ${styles.weekColToday}` : ""}`}
              >
                <div className={styles.weekColHead}>
                  <span className={styles.weekColDow}>{weekdayShortFormatter.format(date).replace(".", "")}</span>
                  <span className={styles.weekColNum}>{date.getDate()}</span>
                </div>
                {dayList.length === 0 && <div className={styles.weekColEmpty} aria-hidden />}
                {dayList.map((item) => {
                  const isSav = item.kind === "sav";
                  const closed = isSav && isClosed(item);
                  const background = isSav ? (closed ? "var(--m-green)" : "var(--m-orange)") : item.color || "var(--primary)";
                  const isContinuation = Boolean(item.date && item.date !== iso);
                  return (
                    <Link
                      key={item.id}
                      href={`/mobile/item/${item.id}`}
                      className={`${styles.weekEvent}${isSav ? ` ${styles.weekEventTone}` : ""}${
                        isContinuation ? ` ${styles.weekEventContinuation}` : ""
                      }`}
                      style={{ background }}
                    >
                      {item.time && <span className={styles.weekEventTime}>{item.time}</span>}
                      <strong>{item.title}</strong>
                      {item.company && <span className={styles.weekEventCompany}>{item.company}</span>}
                      {item.address && <span className={styles.weekEventAddress}>{item.address}</span>}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>
      ) : (
        <>
          <div className={styles.monthGrid}>
            <div className={styles.monthWeekdays}>
              {weekdayLabels.map((label, i) => (
                <span key={i}>{label}</span>
              ))}
            </div>
            <div className={styles.monthCells}>
              {gridDays.map((iso) => {
                const inMonth = Number(iso.slice(5, 7)) - 1 === cursor.month;
                const dayList = itemsOnDay(iso);
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

          <UnlinkedAccountNotice />

      <PullToRefresh className={styles.pageEnter} key={selectedIso} onRefresh={runSync}>
            {dayItems.length === 0 && (
              <div className={styles.empty}>
                <CalendarOff aria-hidden size={30} />
                <strong>{t("today.empty")}</strong>
              </div>
            )}
            {dayItems.map((item, index) => {
              const accent = item.color || (item.kind === "sav" ? "var(--m-orange)" : "var(--primary)");
              const isContinuation = Boolean(item.date && item.date !== selectedIso);
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
                  {isContinuation && <span className={styles.continuationBadge}>{t("common.continuation")}</span>}
                </Link>
              );
            })}
          </PullToRefresh>
        </>
      )}

      {toast && (
        <div className={`${styles.toast}${toast.error ? ` ${styles.toastError}` : ""}`} role="status">
          {toast.text}
        </div>
      )}

      <MobileTabBar />
    </>
  );
}

function isClosed(item: PlanningItem) {
  return item.status === "Clôturé" || Boolean(item.closedAt);
}
