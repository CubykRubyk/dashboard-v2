"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Building2, Save, X } from "lucide-react";

import type { PlanningItem } from "@/components/planification-sav/mock-data";

import { useT } from "./MobilePreferences";
import styles from "./mobile.module.css";

export interface TechnicianChoice {
  id: string;
  name: string;
}

/** `PlanningItem.date`/`time` → valeur d'un `<input type="datetime-local">`. */
function toLocalInput(date: string, time: string | undefined, fallbackTime: string) {
  const hhmm = time && /^\d{2}:\d{2}/.test(time) ? time.slice(0, 5) : fallbackTime;
  return `${date}T${hhmm}`;
}

/**
 * Édition d'une intervention depuis le mobile. **Réservé aux administrateurs** : l'écran n'est pas
 * atteignable autrement (garde côté page), et le bouton n'apparaît pas dans le détail pour un
 * technicien. Comme sur desktop, l'enregistrement écrit dans Dolibarr.
 */
export function EditInterventionScreen({
  item,
  technicians,
}: {
  item: PlanningItem;
  technicians: TechnicianChoice[];
}) {
  const t = useT();
  const router = useRouter();

  const [startAt, setStartAt] = useState(toLocalInput(item.date, item.time, "08:00"));
  const [endAt, setEndAt] = useState(toLocalInput(item.endDate ?? item.date, undefined, "17:00"));
  const [title, setTitle] = useState(item.title);
  const [address, setAddress] = useState(item.address ?? "");
  const [assigneeUserId, setAssigneeUserId] = useState("");
  const [closed, setClosed] = useState(item.status === "Clôturé");
  const [note, setNote] = useState<string | null>(null);

  const [companyQuery, setCompanyQuery] = useState("");
  const [companyResults, setCompanyResults] = useState<{ id: string; name: string; address: string }[]>([]);
  const [company, setCompany] = useState<{ id: string; name: string } | null>(null);

  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  // La note privée vient de Dolibarr, elle n'est pas portée par `PlanningItem`.
  useEffect(() => {
    let cancelled = false;
    const eventId = item.dolibarrEventId || item.reference;
    fetch(`/api/dolibarr/events/${encodeURIComponent(eventId)}`)
      .then((response) => (response.ok ? response.json() : { note: "" }))
      .then((data) => {
        if (!cancelled) setNote(data.note ?? "");
      })
      .catch(() => {
        if (!cancelled) setNote("");
      });
    return () => {
      cancelled = true;
    };
  }, [item.dolibarrEventId, item.reference]);

  // Recherche différée des tiers Dolibarr (`socid` est une référence, pas un texte libre).
  useEffect(() => {
    if (companyQuery.trim().length < 2) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      fetch(`/api/dolibarr/thirdparties?q=${encodeURIComponent(companyQuery)}`)
        .then((response) => (response.ok ? response.json() : { thirdparties: [] }))
        .then((data) => {
          if (!cancelled) setCompanyResults(data.thirdparties ?? []);
        })
        .catch(() => undefined);
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [companyQuery]);

  const visibleCompanies = companyQuery.trim().length >= 2 ? companyResults : [];

  const submit = async () => {
    setPending(true);
    setError("");
    const response = await fetch(`/api/planification-sav/interventions/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startAt,
        endAt,
        title,
        address,
        closed,
        ...(assigneeUserId ? { assigneeUserId } : {}),
        ...(note !== null ? { note } : {}),
        ...(company ? { companyId: company.id, companyName: company.name } : {}),
      }),
    }).catch(() => null);

    setPending(false);
    if (!response) {
      setError("Envoi impossible.");
      return;
    }
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(result.error ?? "Modification refusée.");
      return;
    }
    router.push(`/mobile/item/${item.id}`);
    router.refresh();
  };

  return (
    <>
      <div className={styles.detailNav}>
        <button type="button" onClick={() => router.back()} aria-label={t("edit.cancel")}>
          <ArrowLeft aria-hidden size={19} />
        </button>
        <strong>{t("edit.title")}</strong>
      </div>

      <div className={`${styles.scroll} ${styles.pageEnter}`}>
        <p className={styles.editWarning}>
          <AlertTriangle aria-hidden size={15} />
          {t("edit.warning")}
        </p>

        {error && <p className={styles.editError}>{error}</p>}

        <div className={styles.editCard}>
          <label>
            {t("edit.start")}
            <input
              type="datetime-local"
              value={startAt}
              onChange={(event) => setStartAt(event.target.value)}
            />
          </label>
          <label>
            {t("edit.end")}
            <input
              type="datetime-local"
              value={endAt}
              onChange={(event) => setEndAt(event.target.value)}
            />
          </label>
          <label>
            {t("edit.label")}
            <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={255} />
          </label>
          <label>
            {t("edit.address")}
            <input
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              maxLength={300}
            />
          </label>
        </div>

        <div className={styles.editCard}>
          <label>
            {t("edit.company")}
            <span className={styles.editSearchField}>
              <Building2 aria-hidden size={15} />
              <input
                value={company ? company.name : companyQuery}
                onChange={(event) => {
                  setCompany(null);
                  setCompanyQuery(event.target.value);
                }}
                placeholder={item.company || t("edit.companySearch")}
              />
              {company && (
                <button type="button" onClick={() => { setCompany(null); setCompanyQuery(""); }}>
                  <X aria-hidden size={15} />
                </button>
              )}
            </span>
          </label>
          {!company
            && visibleCompanies.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                className={styles.editResult}
                onClick={() => {
                  setCompany({ id: candidate.id, name: candidate.name });
                  setCompanyResults([]);
                }}
              >
                <strong>{candidate.name}</strong>
                {candidate.address && <small>{candidate.address}</small>}
              </button>
            ))}
          {!company && companyQuery.trim().length >= 2 && visibleCompanies.length === 0 && (
            <p className={styles.editHint}>{t("edit.companyNone")}</p>
          )}
        </div>

        <div className={styles.editCard}>
          <label>
            {t("edit.note")}
            <textarea
              rows={5}
              value={note ?? ""}
              onChange={(event) => setNote(event.target.value)}
              placeholder={note === null ? "…" : ""}
            />
          </label>
        </div>

        <div className={styles.editCard}>
          <label>
            {t("edit.technician")}
            <select
              value={assigneeUserId}
              onChange={(event) => setAssigneeUserId(event.target.value)}
            >
              <option value="">{t("edit.keepTechnician")} ({item.team})</option>
              {technicians.map((technician) => (
                <option key={technician.id} value={technician.id}>{technician.name}</option>
              ))}
            </select>
          </label>
          <label className={styles.editCheckbox}>
            <input
              type="checkbox"
              checked={closed}
              onChange={(event) => setClosed(event.target.checked)}
            />
            {t("edit.closed")}
          </label>
        </div>

        <div className={styles.editActions}>
          <button
            type="button"
            className={styles.editSubmit}
            disabled={pending || !title.trim()}
            onClick={submit}
          >
            <Save aria-hidden size={17} />
            {pending ? t("edit.saving") : t("edit.save")}
          </button>
        </div>
      </div>
    </>
  );
}
