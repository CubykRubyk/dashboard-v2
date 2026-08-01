import "dotenv/config";

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const storageRoot = process.env.TECHNICAL_DOCUMENT_STORAGE_ROOT?.trim();
const databaseUrl = process.env.DATABASE_URL?.trim();
if (!storageRoot || !databaseUrl) {
  throw new Error(
    "TECHNICAL_DOCUMENT_STORAGE_ROOT and DATABASE_URL are required.",
  );
}

const parsedUrl = new URL(databaseUrl);
parsedUrl.searchParams.delete("schema");
const pool = new pg.Pool({
  connectionString: parsedUrl.toString(),
  max: 1,
  application_name: "pac-upload-reconciliation-read-only",
});

const directory = path.join(path.resolve(storageRoot), ".reconciliation");
let names = [];
try {
  names = (await readdir(directory))
    .filter((name) => /^[0-9a-f-]{36}\.json$/i.test(name))
    .sort();
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

const inventory = [];
try {
  await pool.query("BEGIN READ ONLY");
  for (const name of names) {
    const record = JSON.parse(
      await readFile(path.join(directory, name), "utf8"),
    );
    const result = await pool.query(
      'SELECT "id" FROM "TechnicalDocument" WHERE "storageName" = $1',
      [record.storageName],
    );
    inventory.push({
      operationId: record.operationId,
      storageName: record.storageName,
      recordedState: record.reconciliationState,
      databaseCheck: record.databaseCheck,
      databaseReference: result.rowCount === 1 ? "FOUND" : "NOT_FOUND",
      action: result.rowCount === 1
        ? "KEEP_FILE_AND_MARK_COMMITTED"
        : "KEEP_FILE_AND_REVIEW_MANUALLY",
    });
  }
  await pool.query("ROLLBACK");
} finally {
  await pool.end();
}

console.log(JSON.stringify({
  mode: "READ_ONLY",
  records: inventory,
}, null, 2));
