"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, DatabaseBackup, Download, RotateCcw, Save, Trash2 } from "lucide-react";

import { updateBackupSchedule } from "@/app/(dashboard)/settings/actions";

export interface BackupFileView {
  fileName: string;
  sizeBytes: number;
  createdAt: string;
}

export interface BackupSettingsView {
  intervalHours: number | null;
  lastRunAt: string | null;
  lastError: string | null;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} Go`;
}

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function BackupSection({
  databaseName,
  backups,
  settings,
}: {
  databaseName: string;
  backups: BackupFileView[];
  settings: BackupSettingsView;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"create" | "restore" | "schedule" | "">("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const [interval, setIntervalValue] = useState(
    settings.intervalHours ? String(settings.intervalHours) : "",
  );

  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const report = (ok: boolean, text: string) => {
    setIsError(!ok);
    setMessage(text);
  };

  const createBackup = async () => {
    setBusy("create");
    setMessage("");
    const response = await fetch("/api/settings/backup", { method: "POST" });
    const result = await response.json();
    setBusy("");
    report(response.ok, response.ok ? "Sauvegarde créée." : result.error);
    if (response.ok) router.refresh();
  };

  const remove = async (fileName: string) => {
    const response = await fetch(`/api/settings/backup/${fileName}`, { method: "DELETE" });
    if (!response.ok) {
      const result = await response.json();
      report(false, result.error);
      return;
    }
    router.refresh();
  };

  const saveSchedule = async (formData: FormData) => {
    setBusy("schedule");
    setMessage("");
    try {
      await updateBackupSchedule(formData);
      report(true, "Planification enregistrée.");
      router.refresh();
    } catch (error) {
      report(false, error instanceof Error ? error.message : "Enregistrement impossible.");
    } finally {
      setBusy("");
    }
  };

  const restore = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!restoreTarget && !file) {
      report(false, "Choisissez une sauvegarde à restaurer.");
      return;
    }
    setBusy("restore");
    setMessage("");
    const form = new FormData();
    form.set("confirmation", confirmation);
    if (file) form.set("file", file);
    else form.set("fileName", restoreTarget);

    const response = await fetch("/api/settings/backup/restore", { method: "POST", body: form });
    const result = await response.json();
    setBusy("");
    report(response.ok, response.ok ? result.warning : result.error);
    if (response.ok) {
      setRestoreOpen(false);
      setConfirmation("");
      setRestoreTarget("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      router.refresh();
    }
  };

  return (
    <div className="settings-form">
      {message && (
        <div className={`alert ${isError ? "alert-danger" : "alert-success"}`}>{message}</div>
      )}
      {settings.lastError && (
        <div className="alert alert-warning">
          Dernière erreur de sauvegarde : {settings.lastError}
        </div>
      )}

      <form action={saveSchedule} className="settings-form">
        <label>
          Sauvegarde automatique (heures)
          <input
            type="number"
            name="intervalHours"
            min={1}
            max={720}
            value={interval}
            onChange={(event) => setIntervalValue(event.target.value)}
            placeholder="Laisser vide pour désactiver"
          />
          <small>
            Intervalle minimal entre deux sauvegardes automatiques. Vide = désactivée. Les 30
            sauvegardes les plus récentes sont conservées, les plus anciennes sont supprimées
            automatiquement.
          </small>
        </label>
        <div className="settings-actions">
          <button className="button button-primary" disabled={Boolean(busy)}>
            <Save size={16} /> {busy === "schedule" ? "Enregistrement…" : "Enregistrer la planification"}
          </button>
          {settings.lastRunAt && (
            <span className="connection-state configured">
              Dernière sauvegarde : {dateFormatter.format(new Date(settings.lastRunAt))}
            </span>
          )}
        </div>
      </form>

      <div className="settings-actions">
        <button className="button button-primary" onClick={createBackup} disabled={Boolean(busy)}>
          <DatabaseBackup size={16} />{" "}
          {busy === "create" ? "Sauvegarde en cours…" : "Sauvegarder maintenant"}
        </button>
        <button
          className="button button-ghost"
          onClick={() => setRestoreOpen((open) => !open)}
          disabled={Boolean(busy)}
        >
          <RotateCcw size={16} /> Restaurer…
        </button>
      </div>

      {restoreOpen && (
        <div className="alert alert-danger">
          <p>
            <AlertTriangle size={16} /> <strong>Opération destructive.</strong> La restauration
            remplace <strong>toutes</strong> les données actuelles par celles de la sauvegarde.
            Sauvegardez avant de continuer.
          </p>
          <label>
            Sauvegarde existante
            <select value={restoreTarget} onChange={(event) => setRestoreTarget(event.target.value)}>
              <option value="">— Choisir —</option>
              {backups.map((backup) => (
                <option key={backup.fileName} value={backup.fileName}>
                  {dateFormatter.format(new Date(backup.createdAt))} ({formatSize(backup.sizeBytes)})
                </option>
              ))}
            </select>
          </label>
          <label>
            …ou importer un fichier <code>.dump</code>
            <input type="file" accept=".dump" ref={fileInputRef} />
            <small>Utile pour reprendre la base sur un nouveau serveur.</small>
          </label>
          <label>
            Pour confirmer, saisissez le nom de la base : <code>{databaseName}</code>
            <input
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder={databaseName}
              autoComplete="off"
            />
          </label>
          <div className="settings-actions">
            <button
              className="button button-danger"
              onClick={restore}
              disabled={Boolean(busy) || confirmation !== databaseName}
            >
              <RotateCcw size={16} />{" "}
              {busy === "restore" ? "Restauration…" : "Restaurer définitivement"}
            </button>
            <button className="button button-ghost" onClick={() => setRestoreOpen(false)}>
              Annuler
            </button>
          </div>
        </div>
      )}

      <div className="technical-table-wrap">
        <table className="technical-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Taille</th>
              <th>Fichier</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {backups.length === 0 && (
              <tr>
                <td colSpan={4}>Aucune sauvegarde pour l’instant.</td>
              </tr>
            )}
            {backups.map((backup) => (
              <tr key={backup.fileName}>
                <td>{dateFormatter.format(new Date(backup.createdAt))}</td>
                <td>{formatSize(backup.sizeBytes)}</td>
                <td>
                  <code>{backup.fileName}</code>
                </td>
                <td>
                  <div className="settings-actions">
                    <a
                      className="button button-ghost"
                      href={`/api/settings/backup/${backup.fileName}`}
                      download
                    >
                      <Download size={16} /> Télécharger
                    </a>
                    <button className="button button-ghost" onClick={() => remove(backup.fileName)}>
                      <Trash2 size={16} /> Supprimer
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
