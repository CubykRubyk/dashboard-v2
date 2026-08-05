import "server-only";

import { execFile } from "node:child_process";
import { stat, unlink } from "node:fs/promises";
import { promisify } from "node:util";

import { BackupError } from "./errors";
import {
  buildBackupFileName,
  ensureBackupRoot,
  resolveBackupPath,
} from "./storage";

const execFileAsync = promisify(execFile);

// Une sauvegarde/restauration complète peut être longue sur une base chargée — mais pas infinie,
// sinon un `pg_dump` bloqué (verrou, réseau) laisse un process orphelin et un fichier partiel.
const COMMAND_TIMEOUT_MS = 10 * 60 * 1000;

function toolPath(kind: "dump" | "restore") {
  const override =
    kind === "dump" ? process.env.PG_DUMP_BIN?.trim() : process.env.PG_RESTORE_BIN?.trim();
  return override || (kind === "dump" ? "pg_dump" : "pg_restore");
}

/**
 * Les identifiants passent par l'environnement (PGHOST/PGUSER/PGPASSWORD…) et jamais par argv :
 * les arguments d'un process sont lisibles par n'importe quel utilisateur de la machine (`ps`),
 * l'environnement ne l'est pas.
 */
function connectionEnv() {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) throw new BackupError("DATABASE_URL n’est pas configuré.", "COMMAND_FAILED");

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BackupError("DATABASE_URL n’est pas une URL valide.", "COMMAND_FAILED");
  }
  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    throw new BackupError("DATABASE_URL ne pointe pas vers une base PostgreSQL.", "COMMAND_FAILED");
  }

  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!database) throw new BackupError("DATABASE_URL ne contient pas de nom de base.", "COMMAND_FAILED");

  return {
    env: {
      ...process.env,
      PGHOST: decodeURIComponent(url.hostname),
      PGPORT: url.port || "5432",
      PGUSER: decodeURIComponent(url.username),
      PGPASSWORD: decodeURIComponent(url.password),
      PGDATABASE: database,
      // Sans ça, une locale absente du conteneur fait écrire les messages d'erreur dans une
      // langue imprévisible — on veut de l'anglais stable dans `backupLastError`.
      LC_ALL: "C",
    },
    database,
  };
}

function describeFailure(kind: "dump" | "restore", error: unknown): BackupError {
  const err = error as NodeJS.ErrnoException & { stderr?: string; killed?: boolean };
  if (err?.code === "ENOENT") {
    const binary = toolPath(kind);
    return new BackupError(
      `L’outil « ${binary} » est introuvable sur le serveur. Installez le client PostgreSQL ` +
        `(postgresql-client-17) ou renseignez ${kind === "dump" ? "PG_DUMP_BIN" : "PG_RESTORE_BIN"}.`,
      "TOOL_MISSING",
    );
  }
  if (err?.killed) {
    return new BackupError("L’opération a dépassé le délai maximal (10 minutes).", "COMMAND_FAILED");
  }
  const detail = (err?.stderr || err?.message || "").toString().trim().slice(0, 800);
  return new BackupError(detail || "La commande PostgreSQL a échoué.", "COMMAND_FAILED");
}

export interface BackupResult {
  fileName: string;
  sizeBytes: number;
}

export async function runBackup(): Promise<BackupResult> {
  const { env } = connectionEnv();
  const root = await ensureBackupRoot();
  const fileName = buildBackupFileName();
  const destination = resolveBackupPath(fileName, root);

  try {
    await execFileAsync(
      toolPath("dump"),
      // -Fc : format custom (compressé, restaurable sélectivement) ; --no-owner/--no-privileges :
      // le dump reste restaurable sur un serveur où les rôles n'ont pas les mêmes noms.
      ["-Fc", "--no-owner", "--no-privileges", "-f", destination],
      { env, timeout: COMMAND_TIMEOUT_MS, maxBuffer: 8 * 1024 * 1024 },
    );
  } catch (error) {
    // pg_dump laisse un fichier partiel derrière lui en cas d'échec : on ne veut pas qu'il
    // apparaisse dans la liste comme une sauvegarde valide.
    await unlink(destination).catch(() => undefined);
    throw describeFailure("dump", error);
  }

  const stats = await stat(destination).catch(() => null);
  if (!stats || stats.size === 0) {
    await unlink(destination).catch(() => undefined);
    throw new BackupError("La sauvegarde produite est vide.", "COMMAND_FAILED");
  }
  return { fileName, sizeBytes: stats.size };
}

/**
 * Restauration destructive : `--clean --if-exists` supprime les objets existants avant de les
 * recréer. L'appelant doit avoir obtenu une confirmation explicite de l'utilisateur.
 *
 * `--single-transaction` rend l'opération atomique (tout ou rien) — sans lui, un échec au milieu
 * laisserait la base à moitié restaurée, c'est-à-dire inutilisable.
 */
export async function runRestore(filePath: string): Promise<void> {
  const { env, database } = connectionEnv();
  try {
    await execFileAsync(
      toolPath("restore"),
      // `-d` est obligatoire, contrairement à pg_dump : sans lui pg_restore écrit le SQL sur la
      // sortie standard au lieu de restaurer, et refuse même de démarrer. PGDATABASE ne suffit pas.
      // Seul le nom de la base passe en argument — identifiants et hôte restent dans l'environnement.
      [
        "-d",
        database,
        "--clean",
        "--if-exists",
        "--no-owner",
        "--no-privileges",
        "--single-transaction",
        filePath,
      ],
      { env, timeout: COMMAND_TIMEOUT_MS, maxBuffer: 8 * 1024 * 1024 },
    );
  } catch (error) {
    throw describeFailure("restore", error);
  }
}
