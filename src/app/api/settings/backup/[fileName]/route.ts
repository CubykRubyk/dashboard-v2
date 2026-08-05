import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { canManageBackups } from "@/lib/auth/permissions";
import { BackupError } from "@/lib/backup/errors";
import { backupStorageRoot, removeBackup, resolveBackupPath } from "@/lib/backup/storage";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ fileName: string }> },
) {
  const user = await getSession();
  if (!canManageBackups(user?.role)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }
  const { fileName } = await params;

  let filePath: string;
  try {
    filePath = resolveBackupPath(fileName, backupStorageRoot());
  } catch (error) {
    if (error instanceof BackupError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  const stats = await stat(filePath).catch(() => null);
  if (!stats) return NextResponse.json({ error: "Sauvegarde introuvable." }, { status: 404 });

  // Streaming plutôt que `readFile` : un dump peut peser plusieurs centaines de Mo, le charger
  // entièrement en mémoire ferait tomber le serveur (les photos, elles, sont plafonnées à 12 Mo).
  const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream<Uint8Array>;
  return new NextResponse(stream, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(stats.size),
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ fileName: string }> },
) {
  const user = await getSession();
  if (!canManageBackups(user?.role)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }
  const { fileName } = await params;

  try {
    await removeBackup(fileName);
  } catch (error) {
    if (error instanceof BackupError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      return NextResponse.json({ error: "Sauvegarde introuvable." }, { status: 404 });
    }
    throw error;
  }

  await prisma.auditLog.create({
    data: {
      userId: user!.id,
      action: "DB_BACKUP_DELETE",
      entityType: "AppSettings",
      entityId: "1",
      metadata: { fileName },
    },
  });
  return NextResponse.json({ ok: true });
}
