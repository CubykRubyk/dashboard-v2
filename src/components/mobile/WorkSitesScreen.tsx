"use client";

import Link from "next/link";
import { ChevronRight, HardHat, Images } from "lucide-react";

import { useT } from "./MobilePreferences";
import { MobileTabBar } from "./MobileTabBar";
import { UnlinkedAccountNotice } from "./UnlinkedAccountNotice";
import { PullToRefresh } from "./PullToRefresh";
import styles from "./mobile.module.css";

export interface WorkSiteEntry {
  id: string;
  client: string;
  company: string;
  date: string;
  photoCount: number;
}

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  month: "long",
  year: "numeric",
});

/**
 * Chantiers réalisés par le technicien. N'affiche que les fiches réellement **envoyées vers
 * Dolibarr** — c'est la demande d'Ion : un chantier n'entre dans cette liste qu'une fois la fiche
 * validée par l'administrateur, pas dès que le technicien la remplit.
 */
export function WorkSitesScreen({ sites }: { sites: WorkSiteEntry[] }) {
  const t = useT();

  return (
    <>
      <header className={styles.topBar}>
        <div className={styles.topRow}>
          <div>
            <p className={styles.topEyebrow}>{t("worksites.subtitle")}</p>
            <h1 className={styles.topTitle}>{t("worksites.title")}</h1>
          </div>
          <span className={styles.topCount}>{sites.length}</span>
        </div>
      </header>

      <UnlinkedAccountNotice />

      <PullToRefresh className={styles.pageEnter}>
        {sites.length === 0 && (
          <div className={styles.empty}>
            <HardHat aria-hidden size={30} />
            <strong>{t("worksites.empty")}</strong>
            <p>{t("worksites.emptyHint")}</p>
          </div>
        )}
        {sites.map((site, index) => (
          <Link
            key={site.id}
            href={`/fiches/${site.id}`}
            className={`${styles.row} ${styles.stagger}`}
            style={
              {
                "--row-accent": "var(--m-green)",
                "--i": Math.min(index, 12),
              } as React.CSSProperties
            }
          >
            <span className={styles.rowMain}>
              <strong>{site.client}</strong>
              <small>
                {[site.company, dateFormatter.format(new Date(`${site.date}T12:00:00`))]
                  .filter(Boolean)
                  .join(" · ")}
              </small>
            </span>
            {site.photoCount > 0 && (
              <span className={styles.statusPill}>
                <Images aria-hidden size={13} /> {site.photoCount}
              </span>
            )}
            <ChevronRight aria-hidden size={17} className={styles.rowChevron} />
          </Link>
        ))}
      </PullToRefresh>

      <MobileTabBar />
    </>
  );
}
