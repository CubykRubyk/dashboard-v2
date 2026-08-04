"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, SearchX } from "lucide-react";
import { useT } from "./MobilePreferences";
import { MobileTabBar } from "./MobileTabBar";
import { PullToRefresh } from "./PullToRefresh";
import type { PlanningItem } from "@/components/planification-sav/mock-data";
import styles from "./mobile.module.css";

type StatusFilter = "all" | "open" | "closed";

export function SavScreen({ tickets }: { tickets: PlanningItem[] }) {
  const t = useT();
  const [filter, setFilter] = useState<StatusFilter>("all");

  const visible = useMemo(() => {
    if (filter === "all") return tickets;
    const wantClosed = filter === "closed";
    return tickets.filter((ticket) => (ticket.status === "Clôturé") === wantClosed);
  }, [filter, tickets]);

  const filters: { value: StatusFilter; label: string }[] = [
    { value: "all", label: t("sav.filter.all") },
    { value: "open", label: t("sav.filter.open") },
    { value: "closed", label: t("sav.filter.closed") },
  ];

  return (
    <>
      <header className={styles.topBar}>
        <div className={styles.topRow}>
          <div>
            <p className={styles.topEyebrow}>{t("sav.subtitle")}</p>
            <h1 className={styles.topTitle}>{t("sav.title")}</h1>
          </div>
          <span className={styles.topCount}>{visible.length}/{tickets.length}</span>
        </div>
      </header>

      <div className={styles.chipRow} role="group" aria-label={t("sav.title")}>
        {filters.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`${styles.chip}${filter === option.value ? ` ${styles.chipActive}` : ""}`}
            onClick={() => setFilter(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <PullToRefresh className={styles.pageEnter} key={filter}>
        {visible.length === 0 && (
          <div className={styles.empty}>
            <SearchX aria-hidden size={30} />
            <strong>{t("sav.empty")}</strong>
            <p>{t("sav.emptyHint")}</p>
          </div>
        )}
        {visible.map((ticket, index) => {
          const closed = ticket.status === "Clôturé";
          const urgent = !closed && ticket.priority === "Urgente";
          return (
            <Link
              key={ticket.id}
              href={`/mobile/item/${ticket.id}`}
              className={`${styles.row} ${styles.stagger}`}
              style={
                {
                  "--row-accent": closed ? "var(--m-green)" : urgent ? "var(--m-red)" : "var(--m-orange)",
                  "--i": Math.min(index, 12),
                } as React.CSSProperties
              }
            >
              <span className={styles.rowMain}>
                <strong>{ticket.reference} · {ticket.title}</strong>
                <small>{[ticket.company, ticket.address].filter(Boolean).join(" · ")}</small>
              </span>
              <span
                className={`${styles.statusPill} ${
                  closed ? styles.statusClosed : urgent ? styles.statusUrgent : styles.statusOpen
                }`}
              >
                {closed ? t("sav.status.closed") : t("sav.status.open")}
              </span>
              <ChevronRight aria-hidden size={17} className={styles.rowChevron} />
            </Link>
          );
        })}
      </PullToRefresh>

      <MobileTabBar />
    </>
  );
}
