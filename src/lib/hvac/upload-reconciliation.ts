import { randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  rename,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { technicalDocumentStorageRoot } from "@/lib/hvac/document-storage";

const OPERATION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type UploadDatabaseCheck =
  | "NOT_ATTEMPTED"
  | "COMMIT_CONFIRMED"
  | "ROLLBACK_CONFIRMED"
  | "REFERENCE_FOUND"
  | "REFERENCE_NOT_FOUND"
  | "CHECK_FAILED";

export type UploadReconciliationState =
  | "PENDING_DB"
  | "COMMITTED"
  | "ROLLED_BACK"
  | "AMBIGUOUS";

export interface UploadReconciliationRecord {
  version: 1;
  operationId: string;
  storageName: string;
  logicalDocumentName: string;
  checksumSha256: string;
  sizeBytes: number;
  mimeType: string;
  actorId: string;
  createdAt: string;
  updatedAt: string;
  databaseCheck: UploadDatabaseCheck;
  ambiguityReason: string | null;
  reconciliationState: UploadReconciliationState;
}

function reconciliationDirectory(storageRoot = technicalDocumentStorageRoot()) {
  return path.join(path.resolve(storageRoot), ".reconciliation");
}

function recordPath(operationId: string, storageRoot?: string) {
  if (!OPERATION_ID_PATTERN.test(operationId)) {
    throw new Error("Invalid upload reconciliation operation id.");
  }
  const directory = reconciliationDirectory(storageRoot);
  const resolved = path.resolve(directory, `${operationId}.json`);
  if (path.dirname(resolved) !== directory) {
    throw new Error("Invalid upload reconciliation record path.");
  }
  return resolved;
}

function serialize(record: UploadReconciliationRecord) {
  return `${JSON.stringify(record, null, 2)}\n`;
}

export async function createUploadReconciliationRecord(
  input: Omit<
    UploadReconciliationRecord,
    "version" | "operationId" | "createdAt" | "updatedAt"
      | "databaseCheck" | "ambiguityReason" | "reconciliationState"
  >,
  options: {
    operationId?: string;
    storageRoot?: string;
    now?: () => Date;
  } = {},
) {
  const operationId = options.operationId ?? randomUUID();
  const timestamp = (options.now ?? (() => new Date()))().toISOString();
  const record: UploadReconciliationRecord = {
    version: 1,
    operationId,
    ...input,
    createdAt: timestamp,
    updatedAt: timestamp,
    databaseCheck: "NOT_ATTEMPTED",
    ambiguityReason: null,
    reconciliationState: "PENDING_DB",
  };
  const directory = reconciliationDirectory(options.storageRoot);
  await mkdir(directory, { recursive: true, mode: 0o750 });
  await writeFile(
    recordPath(operationId, options.storageRoot),
    serialize(record),
    { flag: "wx", mode: 0o640 },
  );
  return record;
}

export async function readUploadReconciliationRecord(
  operationId: string,
  storageRoot?: string,
) {
  const content = await readFile(recordPath(operationId, storageRoot), "utf8");
  return JSON.parse(content) as UploadReconciliationRecord;
}

export async function updateUploadReconciliationRecord(
  operationId: string,
  update: Pick<
    UploadReconciliationRecord,
    "databaseCheck" | "ambiguityReason" | "reconciliationState"
  >,
  options: {
    storageRoot?: string;
    now?: () => Date;
  } = {},
) {
  const current = await readUploadReconciliationRecord(
    operationId,
    options.storageRoot,
  );
  const next: UploadReconciliationRecord = {
    ...current,
    ...update,
    updatedAt: (options.now ?? (() => new Date()))().toISOString(),
  };
  const destination = recordPath(operationId, options.storageRoot);
  const temporary = `${destination}.${randomUUID()}.tmp`;
  await writeFile(temporary, serialize(next), {
    flag: "wx",
    mode: 0o640,
  });
  await rename(temporary, destination);
  return next;
}

export async function listUploadReconciliationRecords(
  storageRoot?: string,
) {
  const directory = reconciliationDirectory(storageRoot);
  let names: string[];
  try {
    names = await readdir(directory);
  } catch (error) {
    if (
      error
      && typeof error === "object"
      && "code" in error
      && error.code === "ENOENT"
    ) {
      return [];
    }
    throw error;
  }
  const records = await Promise.all(
    names
      .filter((name) => (
        name.endsWith(".json")
        && OPERATION_ID_PATTERN.test(name.slice(0, -5))
      ))
      .sort()
      .map((name) => readUploadReconciliationRecord(
        name.slice(0, -5),
        storageRoot,
      )),
  );
  return records;
}

export async function reconcileUploadOperation(
  operationId: string,
  lookupPersisted: (
    storageName: string,
  ) => Promise<{ id: string } | null>,
  options: {
    storageRoot?: string;
    now?: () => Date;
  } = {},
) {
  const record = await readUploadReconciliationRecord(
    operationId,
    options.storageRoot,
  );
  if (
    record.reconciliationState === "COMMITTED"
    || record.reconciliationState === "ROLLED_BACK"
  ) {
    return record;
  }
  try {
    const persisted = await lookupPersisted(record.storageName);
    return updateUploadReconciliationRecord(operationId, {
      databaseCheck: persisted ? "REFERENCE_FOUND" : "REFERENCE_NOT_FOUND",
      ambiguityReason: persisted
        ? null
        : record.ambiguityReason ?? "No database reference was found.",
      reconciliationState: persisted ? "COMMITTED" : "AMBIGUOUS",
    }, options);
  } catch (error) {
    return updateUploadReconciliationRecord(operationId, {
      databaseCheck: "CHECK_FAILED",
      ambiguityReason: error instanceof Error
        ? error.message.slice(0, 500)
        : "Database reconciliation check failed.",
      reconciliationState: "AMBIGUOUS",
    }, options);
  }
}
