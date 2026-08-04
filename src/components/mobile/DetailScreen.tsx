"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  MapPin,
  Navigation,
  Phone,
  UsersRound,
  Wrench,
} from "lucide-react";
import { useMobilePreferences } from "./MobilePreferences";
import { NoteRichText, type NoteToken } from "@/components/ui/NoteRichText";
import type { PlanningItem } from "@/components/planification-sav/mock-data";
import styles from "./mobile.module.css";

const LOCALE_TAGS = { fr: "fr-FR", ro: "ro-RO", ru: "ru-RU" } as const;

export function DetailScreen({ item }: { item: PlanningItem }) {
  const { t, locale } = useMobilePreferences();
  const isIntervention = item.kind === "intervention";
  const eventId = isIntervention ? item.dolibarrEventId || item.reference : "";

  const [noteTokens, setNoteTokens] = useState<NoteToken[] | null>(null);
  const [notePhone, setNotePhone] = useState("");
  const [noteLoading, setNoteLoading] = useState(Boolean(eventId));

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    fetch(`/api/dolibarr/events/${encodeURIComponent(eventId)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancelled) return;
        setNoteTokens(data?.noteTokens || []);
        setNotePhone(data?.phone || "");
      })
      .catch(() => {
        if (!cancelled) setNoteTokens([]);
      })
      .finally(() => {
        if (!cancelled) setNoteLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const phone = item.phone || notePhone;
  const dateLabel = item.date
    ? new Intl.DateTimeFormat(LOCALE_TAGS[locale], { weekday: "long", day: "numeric", month: "long" }).format(
        new Date(`${item.date}T12:00:00`),
      )
    : "";

  return (
    <>
      <div className={styles.detailNav}>
        <Link href="/mobile" className={styles.navButton}>
          <ChevronLeft aria-hidden size={19} />
          {t("detail.back")}
        </Link>
      </div>

      <div className={`${styles.scroll} ${styles.pageEnter}`}>
        <div className={styles.detailHero}>
          <span className={`${styles.kindBadge} ${isIntervention ? styles.kindIntervention : styles.kindSav}`}>
            {isIntervention ? <CalendarDays aria-hidden size={12} /> : <Wrench aria-hidden size={12} />}
            {isIntervention ? t("detail.intervention") : t("detail.sav")}
            {item.time ? ` · ${item.time}` : ""}
          </span>
          <h1>{item.title}</h1>
          <p>{item.company || item.contact}</p>
        </div>

        {(phone || item.address) && (
          <div className={styles.quickActions}>
            {phone && (
              <a href={`tel:${phone.replace(/\s/g, "")}`} className={`${styles.quickAction} ${styles.quickCall}`}>
                <Phone aria-hidden size={19} />
                {t("detail.call")}
              </a>
            )}
            {item.address && (
              <a
                href={`https://maps.apple.com/?daddr=${encodeURIComponent(item.address)}`}
                target="_blank"
                rel="noreferrer"
                className={`${styles.quickAction} ${styles.quickRoute}`}
              >
                <Navigation aria-hidden size={19} />
                {t("detail.route")}
              </a>
            )}
          </div>
        )}

        <div className={styles.card}>
          {item.address && (
            <a
              href={`https://maps.apple.com/?daddr=${encodeURIComponent(item.address)}`}
              target="_blank"
              rel="noreferrer"
              className={styles.field}
            >
              <span className={styles.fieldIcon}><MapPin aria-hidden size={15} /></span>
              <span className={styles.fieldBody}>
                <small>{t("detail.address")}</small>
                <strong>{item.address}</strong>
              </span>
            </a>
          )}
          {phone && (
            <a href={`tel:${phone.replace(/\s/g, "")}`} className={styles.field}>
              <span className={styles.fieldIcon}><Phone aria-hidden size={15} /></span>
              <span className={styles.fieldBody}>
                <small>{t("detail.phone")}</small>
                <strong>{phone}</strong>
              </span>
            </a>
          )}
          <div className={styles.field}>
            <span className={styles.fieldIcon}><UsersRound aria-hidden size={15} /></span>
            <span className={styles.fieldBody}>
              <small>{t("detail.team")}</small>
              <strong>{item.team}</strong>
            </span>
          </div>
          {dateLabel && (
            <div className={styles.field}>
              <span className={styles.fieldIcon}><CalendarDays aria-hidden size={15} /></span>
              <span className={styles.fieldBody}>
                <small>{t("detail.date")}</small>
                <strong>{dateLabel}</strong>
              </span>
            </div>
          )}
          {item.equipment && (
            <div className={styles.field}>
              <span className={styles.fieldIcon}><Wrench aria-hidden size={15} /></span>
              <span className={styles.fieldBody}>
                <small>{t("detail.equipment")}</small>
                <strong>{item.equipment}</strong>
              </span>
            </div>
          )}
        </div>

        <div className={styles.noteCard}>
          <small>{t("detail.note")}</small>
          <p>
            {isIntervention ? (
              noteLoading ? (
                t("detail.loadingNote")
              ) : noteTokens && noteTokens.length > 0 ? (
                <NoteRichText tokens={noteTokens} />
              ) : (
                t("detail.noNote")
              )
            ) : (
              item.description || t("detail.noNote")
            )}
          </p>
        </div>
      </div>

      <div className={styles.footerBar}>
        <Link href={`/mobile/item/${item.id}/finir`} className={styles.primaryButton}>
          <CheckCircle2 aria-hidden size={17} />
          {t("detail.finish")}
        </Link>
      </div>
    </>
  );
}
