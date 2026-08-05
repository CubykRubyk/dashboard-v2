"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, DownloadCloud, Search, Star, UsersRound } from "lucide-react";

export interface DirectoryEntry {
  id: string;
  dolibarrId: string;
  name: string;
  detail: string;
  favorite: boolean;
}

export interface DirectoryStats {
  users: number;
  companies: number;
  favoriteUsers: number;
  favoriteCompanies: number;
  syncedAt: string | null;
  error: string | null;
}

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
});

/**
 * Import du répertoire Dolibarr et gestion des favoris.
 *
 * Les favoris sont **communs à toute la société** (décision d'Ion) : ce que l'un marque, tous le
 * voient dans leurs sélecteurs. L'import est en lecture seule côté Dolibarr — deux `GET`.
 */
export function DolibarrDirectorySection({
  stats,
  users,
  companies,
}: {
  stats: DirectoryStats;
  users: DirectoryEntry[];
  companies: DirectoryEntry[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [userFilter, setUserFilter] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");

  const runImport = async () => {
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/settings/dolibarr/import", { method: "POST" })
      .catch(() => null);
    const body = await response?.json().catch(() => ({}));
    setBusy(false);
    setIsError(!response?.ok);
    setMessage(response?.ok ? body.message : (body?.error ?? "Import impossible."));
    if (response?.ok) router.refresh();
  };

  const toggleFavorite = async (kind: "users" | "companies", entry: DirectoryEntry) => {
    const response = await fetch(
      `/api/dolibarr/directory/${kind}?id=${encodeURIComponent(entry.id)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ favorite: !entry.favorite }),
      },
    ).catch(() => null);
    if (response?.ok) router.refresh();
    else {
      setIsError(true);
      setMessage("Modification du favori impossible.");
    }
  };

  // Filtrage local : les listes affichées sont déjà plafonnées côté serveur, ce champ ne sert
  // qu'à retrouver rapidement une ligne parmi celles qui sont là.
  const visible = (entries: DirectoryEntry[], filter: string) => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return entries;
    return entries.filter(
      (entry) =>
        entry.name.toLowerCase().includes(needle)
        || entry.detail.toLowerCase().includes(needle),
    );
  };

  const renderList = (kind: "users" | "companies", entries: DirectoryEntry[]) => (
    <div className="technical-table-wrap">
      <table className="technical-table">
        <tbody>
          {entries.length === 0 && (
            <tr>
              <td colSpan={3}>Aucune entrée. Lancez l’import ci-dessus.</td>
            </tr>
          )}
          {entries.map((entry) => (
            <tr key={entry.id}>
              <td style={{ width: 42 }}>
                <button
                  type="button"
                  className="button button-ghost"
                  aria-label={entry.favorite ? `Retirer ${entry.name} des favoris` : `Ajouter ${entry.name} aux favoris`}
                  aria-pressed={entry.favorite}
                  onClick={() => toggleFavorite(kind, entry)}
                >
                  <Star
                    size={16}
                    fill={entry.favorite ? "currentColor" : "none"}
                    color={entry.favorite ? "var(--warning, #f5a524)" : "currentColor"}
                  />
                </button>
              </td>
              <td>
                <strong>{entry.name}</strong>
                {entry.detail && <><br /><small>{entry.detail}</small></>}
              </td>
              <td style={{ textAlign: "right" }}>
                <small>#{entry.dolibarrId}</small>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="settings-form">
      {message && (
        <div className={`alert ${isError ? "alert-danger" : "alert-success"}`} role="status">
          {message}
        </div>
      )}
      {stats.error && !message && (
        <div className="alert alert-warning">Dernier import en échec : {stats.error}</div>
      )}

      <div className="settings-actions">
        <button className="button button-primary" disabled={busy} onClick={runImport}>
          <DownloadCloud size={16} /> {busy ? "Import en cours…" : "Importer depuis Dolibarr"}
        </button>
        {stats.syncedAt && (
          <span className="connection-state configured">
            Dernier import : {dateFormatter.format(new Date(stats.syncedAt))}
          </span>
        )}
      </div>
      <small>
        Récupère les utilisateurs et les sociétés clientes. Opération en lecture seule : rien n’est
        modifié dans Dolibarr. Les entrées disparues y sont désactivées ici, jamais supprimées —
        les favoris et l’historique restent intacts.
      </small>

      <div className="settings-heading">
        <div className="settings-title">
          <span className="settings-icon"><UsersRound size={18} /></span>
          <div>
            <h3>Utilisateurs ({stats.users})</h3>
            <p>{stats.favoriteUsers} en favoris — proposés en premier lors d’une affectation.</p>
          </div>
        </div>
      </div>
      <label>
        <span className="input-shell">
          <Search size={15} />
          <input
            value={userFilter}
            onChange={(event) => setUserFilter(event.target.value)}
            placeholder="Filtrer les utilisateurs…"
          />
        </span>
      </label>
      {renderList("users", visible(users, userFilter))}

      <div className="settings-heading">
        <div className="settings-title">
          <span className="settings-icon"><Building2 size={18} /></span>
          <div>
            <h3>Sociétés clientes ({stats.companies})</h3>
            <p>{stats.favoriteCompanies} en favoris. Les fournisseurs ne sont pas importés.</p>
          </div>
        </div>
      </div>
      <label>
        <span className="input-shell">
          <Search size={15} />
          <input
            value={companyFilter}
            onChange={(event) => setCompanyFilter(event.target.value)}
            placeholder="Filtrer les sociétés…"
          />
        </span>
      </label>
      {renderList("companies", visible(companies, companyFilter))}
    </div>
  );
}
