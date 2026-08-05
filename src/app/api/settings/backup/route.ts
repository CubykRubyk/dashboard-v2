import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { canManageBackups } from "@/lib/auth/permissions";
import { BackupError } from "@/lib/backup/errors";
import { createBackup, getBackupSettings } from "@/lib/backup/service";
import { listBackups } from "@/lib/backup/storage";

export async function GET() {
  const user = await getSession();
  if (!canManageBackups(user?.role)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const [backups, settings] = await Promise.all([listBackups(), getBackupSettings()]);
  return NextResponse.json({
    backups: backups.map((backup) => ({
      fileName: backup.fileName,
      sizeBytes: backup.sizeBytes,
      createdAt: backup.createdAt.toISOString(),
    })),
    settings: {
      intervalHours: settings.backupIntervalHours,
      lastRunAt: settings.backupLastRunAt?.toISOString() ?? null,
      lastError: settings.backupLastError,
    },
  });
}

export async function POST() {
  const user = await getSession();
  if (!canManageBackups(user?.role)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  try {
    const result = await createBackup(user!.id, "MANUAL");
    return NextResponse.json({ backup: result }, { status: 201 });
  } catch (error) {
    if (error instanceof BackupError) {
      // 503 pour un outil manquant : c'est un problème de déploiement, pas une requête invalide.
      return NextResponse.json(
        { error: error.message },
        { status: error.code === "TOOL_MISSING" ? 503 : 500 },
      );
    }
    throw error;
  }
}
