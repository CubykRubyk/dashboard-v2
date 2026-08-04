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
type PriorityFilter = "all" | PlanningItem["priority"];

const PRIORITIES: PlanningItem["priority"][] = ["Urgente", "Haute", "Normale", "Basse"];

export function SavScreen({ tickets }: { tickets: PlanningItem[] }) {
  const t = useT();
  const [status, setStatus] = useState<StatusFilter>("all");
  const [priority, setPriority] = useState<PriorityFilter>("all");
  const [company, setCompany] = useState("all");

  const companies = useMemo(
    () => Array.from(new Set(tickets.map((ticket) => ticket.company).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [tickets],
  );

  const visible = useMemo(() => {
    return tickets.filter((ticket) => {
      const closed = ticket.status === "Clôturé";
      if (status === "open" && closed) return false;
      if (status === "closed" && !closed) return false;
      if (priority !== "all" && ticket.priority !== priority) return false;
      if (company !== "all" && ticket.company !== company) return false;
      return true;
    });
  }, [company, priority, status, tickets]);

  const statusOptions: { value: StatusFilter; label: string }[] = [
    { value: "all", label: t("sav.filter.all") },
    { value: "open", label: t("sav.filter.open") },
    { value: "closed", label: t("sav.filter.closed") },
  ];
  const priorityOptions: { value: PriorityFilter; label: string }[] = [
    { value: "all", label: t("sav.filter.all") },
    ...PRIORITIES.map((value) => ({ value, label: value })),
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
        {statusOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`${styles.chip}${status === option.value ? ` ${styles.chipActive}` : ""}`}
            onClick={() => setStatus(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className={styles.chipRow} role="group" aria-label={t("sav.filter.priority")}>
        {priorityOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`${styles.chip}${priority === option.value ? ` ${styles.chipActive}` : ""}`}
            onClick={() => setPriority(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {companies.length > 0 && (
        <div className={styles.filterBar}>
          <select className={styles.filterSelect} value={company} onChange={(event) => setCompany(event.target.value)}>
            <option value="all">{t("sav.filter.allCompanies")}</option>
            {companies.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
      )}

      <PullToRefresh className={styles.pageEnter} key={`${status}-${priority}-${company}`}>
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
