import assert from "node:assert/strict";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { BackupError } from "../../src/lib/backup/errors";
import {
  buildBackupFileName,
  listBackups,
  pruneBackups,
  removeBackup,
  resolveBackupPath,
} from "../../src/lib/backup/storage";

async function withTempRoot(run: (root: string) => Promise<void>) {
  const root = await mkdtemp(path.join(os.tmpdir(), "backup-storage-test-"));
  const previous = process.env.DB_BACKUP_STORAGE_ROOT;
  process.env.DB_BACKUP_STORAGE_ROOT = root;
  try {
    await run(root);
  } finally {
    if (previous === undefined) delete process.env.DB_BACKUP_STORAGE_ROOT;
    else process.env.DB_BACKUP_STORAGE_ROOT = previous;
    await rm(root, { recursive: true, force: true });
  }
}

/** Crée un faux dump daté, pour contrôler l'ordre de tri sans dépendre de l'horloge. */
async function seedBackup(root: string, date: Date, content = "PGDMP-fake") {
  const fileName = buildBackupFileName(date);
  await writeFile(path.join(root, fileName), content);
  return fileName;
}

test("buildBackupFileName produit un nom trié chronologiquement", () => {
  const older = buildBackupFileName(new Date("2026-01-02T03:04:05"));
  const newer = buildBackupFileName(new Date("2026-01-02T03:04:06"));
  assert.match(older, /^dashboard-20260102-030405-[0-9a-f]{8}\.dump$/);
  // L'ordre alphabétique doit coïncider avec l'ordre chronologique.
  assert.ok(older < newer, `${older} devrait précéder ${newer}`);
});

test("resolveBackupPath refuse les noms hors motif et les traversées de chemin", () => {
  const root = "/tmp/backups";
  const valid = buildBackupFileName(new Date("2026-03-04T05:06:07"));
  assert.equal(resolveBackupPath(valid, root), path.join(root, valid));

  for (const invalid of [
    "../../.env",
    "dashboard-20260102-030405-1a2b3c4d.dump/../../secret",
    "arbitraire.dump",
    "dashboard-20260102-030405-XYZ.dump", // suffixe non hexadécimal
    "dashboard-2026-01-02-030405-1a2b3c4d.dump",
    "dashboard-20260102-030405-1a2b3c4d.sql",
  ]) {
    assert.throws(
      () => resolveBackupPath(invalid, root),
      (error: unknown) => error instanceof BackupError && error.code === "INVALID_FILE",
      `« ${invalid} » aurait dû être refusé`,
    );
  }
});

test("listBackups ignore les fichiers étrangers et trie du plus récent au plus ancien", async () => {
  await withTempRoot(async (root) => {
    const oldest = await seedBackup(root, new Date("2026-01-01T10:00:00"));
    const middle = await seedBackup(root, new Date("2026-02-01T10:00:00"));
    const newest = await seedBackup(root, new Date("2026-03-01T10:00:00"));
    // Fichiers qui ne sont pas des sauvegardes : ne doivent jamais apparaître.
    await writeFile(path.join(root, "notes.txt"), "bruit");
    await writeFile(path.join(root, ".env"), "SECRET=1");

    const listed = await listBackups();
    assert.deepEqual(
      listed.map((backup) => backup.fileName).sort(),
      [oldest, middle, newest].sort(),
    );
    assert.equal(listed.length, 3);
    // Tri décroissant sur la date de modification.
    assert.ok(listed[0].createdAt.getTime() >= listed[1].createdAt.getTime());
    assert.ok(listed[1].createdAt.getTime() >= listed[2].createdAt.getTime());
    assert.ok(listed.every((backup) => backup.sizeBytes > 0));
  });
});

test("pruneBackups ne garde que les N plus récentes", async () => {
  await withTempRoot(async (root) => {
    // Écrits dans le désordre volontairement : c'est la date de modification qui doit trancher,
    // pas l'ordre de création des fichiers.
    await seedBackup(root, new Date("2026-01-01T10:00:00"));
    await seedBackup(root, new Date("2026-03-01T10:00:00"));
    await seedBackup(root, new Date("2026-02-01T10:00:00"));
    await seedBackup(root, new Date("2026-04-01T10:00:00"));

    const before = await listBackups();
    assert.equal(before.length, 4);

    const pruned = await pruneBackups(2);
    assert.equal(pruned.length, 2);

    const after = await listBackups();
    assert.equal(after.length, 2);
    // Les deux survivantes sont bien les plus récentes.
    assert.deepEqual(
      after.map((backup) => backup.fileName),
      before.slice(0, 2).map((backup) => backup.fileName),
    );
    // Et les fichiers supprimés sont ceux annoncés.
    assert.deepEqual(pruned.sort(), before.slice(2).map((backup) => backup.fileName).sort());
  });
});

test("pruneBackups ne supprime rien si la rétention est nulle ou négative", async () => {
  await withTempRoot(async (root) => {
    await seedBackup(root, new Date("2026-01-01T10:00:00"));
    await seedBackup(root, new Date("2026-02-01T10:00:00"));

    assert.deepEqual(await pruneBackups(0), []);
    assert.deepEqual(await pruneBackups(-5), []);
    assert.equal((await listBackups()).length, 2);
  });
});

test("pruneBackups ne touche pas aux fichiers étrangers", async () => {
  await withTempRoot(async (root) => {
    await seedBackup(root, new Date("2026-01-01T10:00:00"));
    await seedBackup(root, new Date("2026-02-01T10:00:00"));
    await writeFile(path.join(root, "important.txt"), "ne pas supprimer");

    await pruneBackups(1);

    const remaining = await readdir(root);
    assert.ok(remaining.includes("important.txt"), "un fichier étranger a été supprimé");
    assert.equal(remaining.filter((entry) => entry.endsWith(".dump")).length, 1);
  });
});

test("removeBackup supprime la sauvegarde ciblée et refuse un nom invalide", async () => {
  await withTempRoot(async (root) => {
    const kept = await seedBackup(root, new Date("2026-01-01T10:00:00"));
    const removed = await seedBackup(root, new Date("2026-02-01T10:00:00"));

    await removeBackup(removed);
    const remaining = await listBackups();
    assert.deepEqual(remaining.map((backup) => backup.fileName), [kept]);

    await assert.rejects(
      () => removeBackup("../../.env"),
      (error: unknown) => error instanceof BackupError && error.code === "INVALID_FILE",
    );
  });
});
