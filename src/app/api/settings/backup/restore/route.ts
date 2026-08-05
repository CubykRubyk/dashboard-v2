import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { canManageBackups } from "@/lib/auth/permissions";
import { BackupError } from "@/lib/backup/errors";
import { runRestore } from "@/lib/backup/pg";
import { backupStorageRoot, resolveBackupPath } from "@/lib/backup/storage";
import { prisma } from "@/lib/prisma";

// Un dump `pg_dump -Fc` commence toujours par cette signature — même rôle que la vérification
// `%PDF-` sur les documents : refuser tout de suite un fichier qui n'est pas ce qu'il prétend être.
const PGDMP_MAGIC = Buffer.from("PGDMP");

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024; // 2 Go

function databaseName() {
  try {
    const url = new URL(process.env.DATABASE_URL ?? "");
    return decodeURIComponent(url.pathname.replace(/^\//, ""));
  } catch {
    return "";
  }
}

export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!canManageBackups(user?.role)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  // Confirmation explicite : l'utilisateur doit retaper le nom de la base. L'opération écrase
  // l'intégralité des données existantes, un simple clic ne suffit pas.
  const expected = databaseName();
  const confirmation = String(form.get("confirmation") || "").trim();
  if (!expected || confirmation !== expected) {
    return NextResponse.json(
      { error: `Confirmation invalide : saisissez le nom de la base (« ${expected} ») pour continuer.` },
      { status: 400 },
    );
  }

  const uploaded = form.get("file");
  const existingFileName = String(form.get("fileName") || "").trim();

  let filePath: string;
  let tempDir: string | null = null;
  let source: string;

  if (uploaded instanceof File && uploaded.size > 0) {
    if (uploaded.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "Le fichier dépasse 2 Go." }, { status: 400 });
    }
    const bytes = Buffer.from(await uploaded.arrayBuffer());
    if (!bytes.subarray(0, PGDMP_MAGIC.length).equals(PGDMP_MAGIC)) {
      return NextResponse.json(
        { error: "Ce fichier n’est pas une sauvegarde PostgreSQL valide (format custom attendu)." },
        { status: 400 },
      );
    }
    tempDir = await mkdtemp(path.join(/* turbopackIgnore: true */ tmpdir(), "dashboard-restore-"));
    filePath = path.join(/* turbopackIgnore: true */ tempDir, "upload.dump");
    await writeFile(filePath, bytes, { mode: 0o600 });
    source = uploaded.name;
  } else if (existingFileName) {
    try {
      filePath = resolveBackupPath(existingFileName, backupStorageRoot());
    } catch (error) {
      if (error instanceof BackupError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }
    source = existingFileName;
  } else {
    return NextResponse.json({ error: "Aucune sauvegarde fournie." }, { status: 400 });
  }

  // Journalisé AVANT l'opération : si la restauration réussit, la ligne d'audit écrite après coup
  // serait de toute façon écrasée par le contenu du dump — cette trace-là disparaîtra donc, mais
  // elle reste en base si la restauration échoue, ce qui est précisément le cas où on la cherche.
  await prisma.auditLog
    .create({
      data: {
        userId: user!.id,
        action: "DB_RESTORE_START",
        entityType: "AppSettings",
        entityId: "1",
        metadata: { source },
      },
    })
    .catch(() => undefined);

  try {
    await runRestore(filePath);
  } catch (error) {
    if (error instanceof BackupError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.code === "TOOL_MISSING" ? 503 : 500 },
      );
    }
    throw error;
  } finally {
    if (tempDir) await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }

  return NextResponse.json({
    ok: true,
    // Le pool de connexions Prisma et la session en cours pointent vers des données qui viennent
    // d'être remplacées — un redémarrage évite des erreurs transitoires difficiles à diagnostiquer.
    warning:
      "Restauration terminée. Redémarrez l’application et reconnectez-vous : votre session peut ne plus exister dans la base restaurée.",
  });
}
