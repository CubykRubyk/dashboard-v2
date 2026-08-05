import "server-only";

import { prisma } from "@/lib/prisma";

import { BackupError } from "./errors";
import { runBackup } from "./pg";
import { pruneBackups } from "./storage";

const DEFAULT_KEEP = 30;

export type BackupTrigger = "MANUAL" | "SCHEDULED";

function retentionCount() {
  const configured = Number.parseInt(process.env.DB_BACKUP_KEEP ?? "", 10);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_KEEP;
}

export async function getBackupSettings() {
  const settings = await prisma.appSettings.findUnique({
    where: { id: 1 },
    select: { backupIntervalHours: true, backupLastRunAt: true, backupLastError: true },
  });
  return (
    settings ?? { backupIntervalHours: null, backupLastRunAt: null, backupLastError: null }
  );
}

export function isBackupDue(
  settings: { backupIntervalHours: number | null; backupLastRunAt: Date | null },
  now = new Date(),
) {
  const interval = settings.backupIntervalHours;
  if (!interval || interval <= 0) return false;
  if (!settings.backupLastRunAt) return true;
  return now.getTime() - settings.backupLastRunAt.getTime() >= interval * 3600_000;
}

/**
 * Lance une sauvegarde et journalise le résultat des deux côtés : `AppSettings` (état courant,
 * affiché dans les paramètres) et `AuditLog` (historique, comme partout ailleurs dans l'app).
 * Le tandem `backupLastRunAt`/`backupLastError` suit exactement le modèle de la synchro Dolibarr
 * (`dolibarrEventsSyncedAt`/`dolibarrLastSyncError`) : l'erreur est effacée au succès suivant.
 */
export async function createBackup(userId: string | null, trigger: BackupTrigger) {
  try {
    const result = await runBackup();
    const pruned = await pruneBackups(retentionCount()).catch(() => [] as string[]);

    await prisma.appSettings.upsert({
      where: { id: 1 },
      update: { backupLastRunAt: new Date(), backupLastError: null },
      create: { id: 1, backupLastRunAt: new Date(), backupLastError: null },
    });
    // Le fichier est déjà sur disque : une écriture d'audit qui échoue (utilisateur supprimé
    // entre-temps, base en lecture seule…) ne doit pas faire passer une sauvegarde réussie pour
    // un échec — l'utilisateur la verrait marquée en erreur alors qu'elle est parfaitement
    // utilisable. On journalise donc au mieux, sans propager.
    await prisma.auditLog
      .create({
        data: {
          userId,
          action: "DB_BACKUP_CREATE",
          entityType: "AppSettings",
          entityId: "1",
          metadata: {
            trigger,
            fileName: result.fileName,
            sizeBytes: result.sizeBytes,
            ...(pruned.length > 0 ? { prunedFiles: pruned } : {}),
          },
        },
      })
      .catch(() => undefined);
    return result;
  } catch (error) {
    const message =
      error instanceof BackupError ? error.message : "La sauvegarde a échoué pour une raison inconnue.";
    await prisma.appSettings
      .upsert({
        where: { id: 1 },
        update: { backupLastError: message.slice(0, 1000) },
        create: { id: 1, backupLastError: message.slice(0, 1000) },
      })
      .catch(() => undefined);
    await prisma.auditLog
      .create({
        data: {
          userId,
          action: "DB_BACKUP_ERROR",
          entityType: "AppSettings",
          entityId: "1",
          metadata: { trigger, error: message.slice(0, 1000) },
        },
      })
      .catch(() => undefined);
    throw error;
  }
}

/** Utilisé par la route cron : ne fait rien si l'intervalle configuré n'est pas encore écoulé. */
export async function runScheduledBackupIfDue() {
  const settings = await getBackupSettings();
  if (!isBackupDue(settings)) {
    return { ran: false as const, reason: settings.backupIntervalHours ? "not-due" : "disabled" };
  }
  const result = await createBackup(null, "SCHEDULED");
  return { ran: true as const, ...result };
}
