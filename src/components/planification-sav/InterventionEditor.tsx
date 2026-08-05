"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Building2, PenLine, Save, Search, X } from "lucide-react";

import { useDirectoryCompanies, useDirectoryUsers } from "@/lib/hooks/useDolibarrDirectory";

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
  onDone,
}: {
  item: PlanningItem;
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
  const [closed, setClosed] = useState(item.status === "Clôturé");
  const [note, setNote] = useState<string | null>(null);

  // Société et technicien viennent du **répertoire importé** : favoris d'abord, recherche sur tout
  // le répertoire dès qu'on tape. Plus d'appel à Dolibarr à chaque frappe.
  const [companyQuery, setCompanyQuery] = useState("");
  const [company, setCompany] = useState<{ id: string; name: string } | null>(null);
  const { companies: companyResults } = useDirectoryCompanies(companyQuery, editing && !company);

  const [technicianQuery, setTechnicianQuery] = useState("");
  const [technician, setTechnician] = useState<{ dolibarrId: string; name: string } | null>(null);
  const { users: technicianResults } = useDirectoryUsers(technicianQuery, editing && !technician);

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
        ...(technician ? { dolibarrUserId: technician.dolibarrId } : {}),
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
        {!company && companyResults.map((candidate) => (
          <button
            key={candidate.id}
            type="button"
            className={styles.materialResult}
            onClick={() => {
              setCompany({ id: candidate.dolibarrId, name: candidate.name });
              setCompanyQuery("");
            }}
          >
            <Search aria-hidden size={13} />
            <span className={styles.materialInfo}>
              <strong>{candidate.name}</strong>
              {candidate.addressLabel && <small>{candidate.addressLabel}</small>}
            </span>
          </button>
        ))}
        {!company && companyQuery.trim().length >= 2 && companyResults.length === 0 && (
          <small>Aucune société trouvée. Lancez l’import dans Paramètres → Dolibarr.</small>
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
        <span className={styles.materialSearchField}>
          <Search aria-hidden size={15} />
          <input
            value={technician ? technician.name : technicianQuery}
            onChange={(event) => {
              setTechnician(null);
              setTechnicianQuery(event.target.value);
            }}
            placeholder={`Ne pas changer (${item.team})`}
          />
          {technician && (
            <button type="button" onClick={() => { setTechnician(null); setTechnicianQuery(""); }}>
              <X aria-hidden size={14} />
            </button>
          )}
        </span>
        {!technician && technicianResults.map((candidate) => (
          <button
            key={candidate.id}
            type="button"
            className={styles.materialResult}
            onClick={() => {
              setTechnician({ dolibarrId: candidate.dolibarrId, name: candidate.name });
              setTechnicianQuery("");
            }}
          >
            <span className={styles.materialInfo}>
              <strong>{candidate.name}</strong>
              <small>
                {candidate.job || "—"}
                {/* Sans compte CRM, personne à prévenir : autant le dire ici. */}
                {candidate.hasCrmAccount ? "" : " · ne recevra pas de notification"}
              </small>
            </span>
          </button>
        ))}
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
