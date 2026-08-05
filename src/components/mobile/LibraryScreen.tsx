"use client";

import { FileText, Search, SearchX } from "lucide-react";

import type { LibraryEquipment } from "@/lib/mobile/library";

import { useT } from "./MobilePreferences";
import { MobileTabBar } from "./MobileTabBar";
import styles from "./mobile.module.css";

const TYPE_LABELS: Record<string, string> = {
  INDOOR_UNIT: "Unité intérieure",
  OUTDOOR_UNIT: "Unité extérieure",
  MONOBLOC: "Monobloc",
  ACCESSORY: "Accessoire",
  CONTROLLER: "Régulation",
  OTHER: "Autre",
};

const DOCUMENT_LABELS: Record<string, string> = {
  INSTALLATION_MANUAL: "Manuel d’installation",
  USER_MANUAL: "Manuel utilisateur",
  DATASHEET: "Fiche technique",
  WIRING_DIAGRAM: "Schéma de raccordement",
  ERROR_CODES: "Codes d’erreur",
  CERTIFICATE: "Certificat",
  OTHER: "Document",
};

function formatSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.round(bytes / 1024)} Ko`
    : `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

/**
 * Bibliothèque technique de terrain : on cherche une pompe, on ouvre son manuel.
 *
 * Formulaire GET (pas de recherche à la frappe) : la page est un Server Component, donc la
 * réponse est mise en cache par le service worker — une recherche déjà faite reste consultable
 * hors ligne, ce qu'un fetch client ne donnerait pas.
 */
export function LibraryScreen({
  query,
  results,
}: {
  query: string;
  results: LibraryEquipment[];
}) {
  const t = useT();
  const searched = query.trim().length >= 2;

  return (
    <>
      <header className={styles.topBar}>
        <div className={styles.topRow}>
          <div>
            <p className={styles.topEyebrow}>{t("library.subtitle")}</p>
            <h1 className={styles.topTitle}>{t("library.title")}</h1>
          </div>
          {searched && <span className={styles.topCount}>{results.length}</span>}
        </div>
      </header>

      <form className={styles.librarySearch} action="/mobile/bibliotheque" method="get">
        <Search aria-hidden size={17} />
        <input
          name="q"
          defaultValue={query}
          placeholder={t("library.placeholder")}
          autoComplete="off"
          // 16px minimum : en dessous, Safari iOS zoome toute la page au focus (piège déjà
          // rencontré sur l'écran de connexion).
          style={{ fontSize: 16 }}
        />
      </form>

      <div className={styles.scroll}>
        {!searched && <p className={styles.libraryHint}>{t("library.hint")}</p>}

        {searched && results.length === 0 && (
          <div className={styles.empty}>
            <SearchX aria-hidden size={30} />
            <strong>{t("library.empty")}</strong>
            <p>{t("library.emptyHint")}</p>
          </div>
        )}

        {results.map((equipment) => (
          <article key={equipment.id} className={styles.libraryCard}>
            <div className={styles.libraryCardHead}>
              <strong>{equipment.reference}</strong>
              <span>{TYPE_LABELS[equipment.type] ?? equipment.type}</span>
            </div>
            <p className={styles.libraryCardMeta}>
              {[equipment.manufacturer, equipment.range, equipment.name].filter(Boolean).join(" · ")}
            </p>

            {equipment.documents.length === 0 ? (
              <p className={styles.libraryNoDoc}>{t("library.noDocument")}</p>
            ) : (
              equipment.documents.map((document) => (
                <a
                  key={document.id}
                  className={styles.libraryDoc}
                  href={`/api/pac/technical/documents/${document.id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <FileText aria-hidden size={16} />
                  <span className={styles.libraryDocBody}>
                    <strong>{document.title}</strong>
                    <small>
                      {DOCUMENT_LABELS[document.type] ?? document.type} · {formatSize(document.sizeBytes)}
                    </small>
                  </span>
                </a>
              ))
            )}
          </article>
        ))}
      </div>

      <MobileTabBar />
    </>
  );
}
