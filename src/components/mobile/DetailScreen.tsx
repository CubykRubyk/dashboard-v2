"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  MapPin,
  Navigation,
  Phone,
  RefreshCw,
  UsersRound,
  Wrench,
} from "lucide-react";
import { useMobilePreferences } from "./MobilePreferences";
import { MobileSheet } from "./MobileSheet";
import { NoteRichText, type NoteToken } from "@/components/ui/NoteRichText";
import type { PlanningItem } from "@/components/planification-sav/mock-data";
import styles from "./mobile.module.css";

const LOCALE_TAGS = { fr: "fr-FR", ro: "ro-RO", ru: "ru-RU" } as const;

export function DetailScreen({ item }: { item: PlanningItem }) {
  const { t, locale } = useMobilePreferences();
  const router = useRouter();
  const isIntervention = item.kind === "intervention";
  const eventId = isIntervention ? item.dolibarrEventId || item.reference : "";

  const [noteTokens, setNoteTokens] = useState<NoteToken[] | null>(null);
  const [notePhone, setNotePhone] = useState("");
  const [noteLoading, setNoteLoading] = useState(Boolean(eventId));
  const [refreshToken, setRefreshToken] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [routeOpen, setRouteOpen] = useState(false);

  // La note/le téléphone Dolibarr sont mis en cache côté serveur (5 min, voir
  // /api/dolibarr/events/[id]/route.ts) — on ne les redemande donc plus à chaque ouverture. Le
  // bouton ci-dessous force un aller réel avec `?refresh=1` quand on en a vraiment besoin.
  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    const query = refreshToken > 0 ? "?refresh=1" : "";
    fetch(`/api/dolibarr/events/${encodeURIComponent(eventId)}${query}`)
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
  }, [eventId, refreshToken]);

  const refresh = () => {
    setRefreshing(true);
    if (eventId) setNoteLoading(true);
    setRefreshToken((current) => current + 1);
    router.refresh();
    window.setTimeout(() => setRefreshing(false), 600);
  };

  const phone = item.phone || notePhone;
  const dateFormatter = new Intl.DateTimeFormat(LOCALE_TAGS[locale], {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  // Intervention sur plusieurs jours (`date` → `endDate`) — affiche l'intervalle complet, pas
  // seulement le premier jour, sinon on perd l'info que le chantier continue le(s) jour(s) suivant(s).
  const dateLabel = item.date
    ? item.endDate && item.endDate !== item.date
      ? `${dateFormatter.format(new Date(`${item.date}T12:00:00`))} – ${dateFormatter.format(
          new Date(`${item.endDate}T12:00:00`),
        )}`
      : dateFormatter.format(new Date(`${item.date}T12:00:00`))
    : "";

  const routeApps = item.address
    ? [
        { label: t("detail.route.appleMaps"), url: `https://maps.apple.com/?daddr=${encodeURIComponent(item.address)}` },
        {
          label: t("detail.route.googleMaps"),
          url: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(item.address)}`,
        },
        { label: t("detail.route.waze"), url: `https://waze.com/ul?q=${encodeURIComponent(item.address)}&navigate=yes` },
      ]
    : [];

  return (
    <>
      <div className={styles.detailNav}>
        {/* `router.back()` — un lien fixe vers `/mobile` ramenait toujours à "Aujourd'hui" même en
           venant du calendrier ou de SAV, perdant l'écran d'origine. `history.length` évite un
           `back()` qui sortirait carrément de l'app si la fiche a été ouverte en accès direct
           (aucun historique de navigation dans l'app avant elle). */}
        <button
          type="button"
          className={styles.navButton}
          onClick={() => (window.history.length > 1 ? router.back() : router.push("/mobile"))}
        >
          <ChevronLeft aria-hidden size={19} />
          {t("detail.back")}
        </button>
        <button
          type="button"
          className={styles.navButton}
          onClick={refresh}
          disabled={refreshing}
          aria-label={t("common.retry")}
        >
          <RefreshCw aria-hidden size={17} className={refreshing ? styles.spin : undefined} />
        </button>
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
              <button
                type="button"
                onClick={() => setRouteOpen(true)}
                className={`${styles.quickAction} ${styles.quickRoute}`}
              >
                <Navigation aria-hidden size={19} />
                {t("detail.route")}
              </button>
            )}
          </div>
        )}

        <div className={styles.card}>
          {item.address && (
            <button type="button" onClick={() => setRouteOpen(true)} className={styles.field}>
              <span className={styles.fieldIcon}><MapPin aria-hidden size={15} /></span>
              <span className={styles.fieldBody}>
                <small>{t("detail.address")}</small>
                <strong className={styles.fieldValueWrap}>{item.address}</strong>
              </span>
            </button>
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

      <MobileSheet open={routeOpen} onClose={() => setRouteOpen(false)} title={t("detail.route.chooseApp")}>
        <div className={styles.sheetList}>
          {routeApps.map((app) => (
            <a
              key={app.label}
              href={app.url}
              target="_blank"
              rel="noreferrer"
              className={styles.sheetOption}
              onClick={() => setRouteOpen(false)}
            >
              {app.label}
            </a>
          ))}
        </div>
      </MobileSheet>
    </>
  );
}
