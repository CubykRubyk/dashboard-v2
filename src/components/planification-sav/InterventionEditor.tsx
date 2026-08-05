"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Building2, PenLine, Save, Search, X } from "lucide-react";

import type { PlanningItem } from "./mock-data";
import styles from "./planification-sav.module.css";

export interface TechnicianOption {
  id: string;
  name: string;
  /** Un compte sans identifiant Dolibarr ne peut pas recevoir d'intervention. */
  dolibarrUserId: string | null;
}

/** `PlanningItem.date`/`time` → valeur d'un `<input type="datetime-local">`. */
function toLocalInput(date: string, time: string | undefined, fallbackTime: string) {
  const hhmm = time && /^\d{2}:\d{2}/.test(time) ? time.slice(0, 5) : fallbackTime;
  return `${date}T${hhmm}`;
}

/**
 * Édition d'une intervention Dolibarr depuis le drawer. **Écrit dans Dolibarr** (PUT), ce qui en
 * fait la seule action irréversible du module — d'où la réservation aux administrateurs et la
 * confirmation avant envoi.
 */
export function InterventionEditor({
  item,
  technicians,
  onDone,
}: {
  item: PlanningItem;
  technicians: TechnicianOption[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const [startAt, setStartAt] = useState(toLocalInput(item.date, item.time, "08:00"));
  const [endAt, setEndAt] = useState(
    toLocalInput(item.endDate ?? item.date, undefined, "17:00"),
  );
  const [title, setTitle] = useState(item.title);
  const [address, setAddress] = useState(item.address ?? "");
  const [assigneeUserId, setAssigneeUserId] = useState("");
  const [closed, setClosed] = useState(item.status === "Clôturé");
  const [note, setNote] = useState<string | null>(null);

  // Société : `socid` est une référence Dolibarr, pas un texte — on choisit un tiers existant.
  const [companyQuery, setCompanyQuery] = useState("");
  const [companyResults, setCompanyResults] = useState<{ id: string; name: string; address: string }[]>([]);
  const [company, setCompany] = useState<{ id: string; name: string } | null>(null);

  // La note privée n'est pas dans `PlanningItem` : elle vient de Dolibarr, comme dans le drawer.
  useEffect(() => {
    if (!editing || note !== null) return;
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
  }, [editing, note, item.dolibarrEventId, item.reference]);

  // Recherche de tiers, différée comme la recherche de matériel.
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

  const assignable = technicians.filter((technician) => technician.dolibarrUserId);

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
        // Champ laissé vide = affectation inchangée ; l'API distingue `undefined` de `null`.
        ...(assigneeUserId ? { assigneeUserId } : {}),
        ...(note !== null ? { note } : {}),
        ...(company ? { companyId: company.id, companyName: company.name } : {}),
      }),
    }).catch(() => null);

    setPending(false);
    if (!response) {
      setError("Envoi impossible. Vérifiez votre connexion.");
      return;
    }
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(result.error ?? "Modification refusée.");
      return;
    }
    setEditing(false);
    onDone();
    router.refresh();
  };

  if (!editing) {
    return (
      <button type="button" className={styles.drawerAction} onClick={() => setEditing(true)}>
        <PenLine aria-hidden size={16} />
        <span>Modifier l’intervention</span>
      </button>
    );
  }

  return (
    <div className={styles.interventionEditor}>
      <p className={styles.interventionEditorWarning}>
        <AlertTriangle aria-hidden size={14} />
        Les modifications sont écrites dans Dolibarr.
      </p>

      {error && <p className={styles.interventionEditorError}>{error}</p>}

      <label>
        Début
        <input
          type="datetime-local"
          value={startAt}
          onChange={(event) => setStartAt(event.target.value)}
        />
      </label>
      <label>
        Fin
        <input
          type="datetime-local"
          value={endAt}
          onChange={(event) => setEndAt(event.target.value)}
        />
      </label>
      <label>
        Intitulé
        <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={255} />
      </label>
      <label>
        Adresse
        <input
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          maxLength={300}
        />
      </label>
      <label>
        Société cliente
        <span className={styles.materialSearchField}>
          <Building2 aria-hidden size={15} />
          <input
            value={company ? company.name : companyQuery}
            onChange={(event) => {
              setCompany(null);
              setCompanyQuery(event.target.value);
            }}
            placeholder={item.company || "Chercher une société Dolibarr…"}
          />
          {company && (
            <button
              type="button"
              onClick={() => {
                setCompany(null);
                setCompanyQuery("");
              }}
              aria-label="Annuler le changement de société"
            >
              <X aria-hidden size={14} />
            </button>
          )}
        </span>
        {!company && visibleCompanies.map((candidate) => (
          <button
            key={candidate.id}
            type="button"
            className={styles.materialResult}
            onClick={() => {
              setCompany({ id: candidate.id, name: candidate.name });
              setCompanyResults([]);
            }}
          >
            <Search aria-hidden size={13} />
            <span className={styles.materialInfo}>
              <strong>{candidate.name}</strong>
              {candidate.address && <small>{candidate.address}</small>}
            </span>
          </button>
        ))}
        {!company && companyQuery.trim().length >= 2 && visibleCompanies.length === 0 && (
          <small>Aucune société trouvée. Elle doit exister dans Dolibarr.</small>
        )}
      </label>
      <label>
        Note privée
        <textarea
          rows={4}
          value={note ?? ""}
          onChange={(event) => setNote(event.target.value)}
          placeholder={note === null ? "Chargement…" : "Note visible dans Dolibarr"}
        />
      </label>
      <label>
        Technicien
        <select
          value={assigneeUserId}
          onChange={(event) => setAssigneeUserId(event.target.value)}
        >
          <option value="">Ne pas changer ({item.team})</option>
          {assignable.map((technician) => (
            <option key={technician.id} value={technician.id}>{technician.name}</option>
          ))}
        </select>
        {assignable.length === 0 && (
          <small>
            Aucun compte n’a d’identifiant Dolibarr : renseignez-le dans Paramètres → Utilisateurs.
          </small>
        )}
      </label>
      <label className={styles.interventionEditorCheckbox}>
        <input
          type="checkbox"
          checked={closed}
          onChange={(event) => setClosed(event.target.checked)}
        />
        Marquer l’intervention comme terminée
      </label>

      <div className={styles.interventionEditorActions}>
        <button
          type="button"
          className="button button-primary"
          disabled={pending || !title.trim()}
          onClick={submit}
        >
          <Save aria-hidden size={15} /> {pending ? "Envoi vers Dolibarr…" : "Enregistrer"}
        </button>
        <button
          type="button"
          className="button"
          disabled={pending}
          onClick={() => {
            setEditing(false);
            setError("");
          }}
        >
          <X aria-hidden size={15} /> Annuler
        </button>
      </div>
    </div>
  );
}
