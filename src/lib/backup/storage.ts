// Pas de `server-only` ici (contrairement à pg.ts/service.ts) : ce module ne manipule que des
// chemins et des fichiers, aucun secret. Il reste ainsi testable hors Next, comme
// `lib/documents/storage.ts` — voir tests/backup/storage.test.ts.
import { constants } from "node:fs";
import { access, mkdir, readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";

import { BackupError } from "./errors";

// Format `pg_dump -Fc` (custom, compressé) : permet un restore sélectif et reste bien plus
// compact qu'un dump SQL brut. L'extension est fixe, elle sert aussi de garde-fou au moment
// de résoudre un chemin (cf. `resolveBackupPath`).
export const BACKUP_EXTENSION = ".dump";

// Un nom de fichier de sauvegarde est toujours généré par nous (`buildBackupFileName`), jamais
// fourni par l'utilisateur — ce motif est la ceinture de sécurité contre un `..` qui arriverait
// par une route API (même principe que STORAGE_NAME_PATTERN dans lib/worksheets/photo-storage.ts).
const BACKUP_NAME_PATTERN = /^dashboard-\d{8}-\d{6}-[0-9a-f]{8}\.dump$/;

export function backupStorageRoot() {
  const configured = process.env.DB_BACKUP_STORAGE_ROOT?.trim();
  if (process.env.NODE_ENV === "production" && !configured) {
    throw new Error("DB_BACKUP_STORAGE_ROOT doit être configuré en production.");
  }
  return path.resolve(
    /* turbopackIgnore: true */
    configured || path.join(/* turbopackIgnore: true */ process.cwd(), "data", "db-backups"),
  );
}

export async function ensureBackupRoot() {
  const resolved = path.resolve(/* turbopackIgnore: true */ backupStorageRoot());
  await mkdir(resolved, { recursive: true, mode: 0o750 });
  await access(resolved, constants.R_OK | constants.W_OK);
  return resolved;
}

export function resolveBackupPath(fileName: string, root: string) {
  if (!BACKUP_NAME_PATTERN.test(fileName)) {
    throw new BackupError("Le nom du fichier de sauvegarde est invalide.", "INVALID_FILE");
  }
  const resolvedRoot = path.resolve(/* turbopackIgnore: true */ root);
  const resolved = path.resolve(/* turbopackIgnore: true */ resolvedRoot, fileName);
  // Défense en profondeur contre un `..` qui aurait passé le motif ci-dessus.
  if (path.dirname(resolved) !== resolvedRoot) {
    throw new BackupError("Le chemin du fichier est invalide.", "INVALID_FILE");
  }
  return resolved;
}

/** `dashboard-20260804-143000-1a2b3c4d.dump` — trié chronologiquement par ordre alphabétique. */
export function buildBackupFileName(now = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  const stamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const suffix = Math.random().toString(16).slice(2, 10).padEnd(8, "0");
  return `dashboard-${stamp}-${suffix}${BACKUP_EXTENSION}`;
}

export interface BackupFile {
  fileName: string;
  sizeBytes: number;
  createdAt: Date;
}

export async function listBackups(): Promise<BackupFile[]> {
  const root = await ensureBackupRoot();
  const entries = await readdir(root).catch(() => [] as string[]);
  const files = await Promise.all(
    entries
      .filter((entry) => BACKUP_NAME_PATTERN.test(entry))
      .map(async (fileName) => {
        const stats = await stat(path.join(/* turbopackIgnore: true */ root, fileName)).catch(() => null);
        if (!stats) return null;
        return { fileName, sizeBytes: stats.size, createdAt: stats.mtime };
      }),
  );
  return files
    .filter((file): file is BackupFile => file !== null)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function removeBackup(fileName: string) {
  const root = backupStorageRoot();
  await unlink(resolveBackupPath(fileName, root));
}

/**
 * Ne garde que les `keep` sauvegardes les plus récentes. Sans ça une sauvegarde automatique
 * quotidienne remplit le disque en silence — le cas typique où l'on ne s'en aperçoit qu'une
 * fois la base en écriture bloquée.
 */
export async function pruneBackups(keep: number) {
  if (keep <= 0) return [];
  const backups = await listBackups();
  const excess = backups.slice(keep);
  await Promise.all(excess.map((file) => removeBackup(file.fileName).catch(() => undefined)));
  return excess.map((file) => file.fileName);
}
