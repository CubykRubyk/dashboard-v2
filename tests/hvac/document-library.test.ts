import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { TechnicalDocumentType } from "../../src/generated/prisma/enums";
import {
  canManageTechnicalCatalog,
  canReadTechnicalDocuments,
} from "../../src/lib/auth/permissions";
import {
  calculateSha256,
  generateStorageName,
  MAX_TECHNICAL_DOCUMENT_BYTES,
  type DocumentFileLike,
  validatePdfFile,
} from "../../src/lib/hvac/document-file";
import {
  assertUniqueDocumentChecksum,
  type DocumentAssociationLookup,
  persistUploadedDocument,
  technicalDocumentStatusData,
  validateDocumentAssociations,
} from "../../src/lib/hvac/document-service";
import {
  removeTechnicalDocumentFile,
  resolveTechnicalDocumentPath,
  writeTechnicalDocumentFile,
  writeValidatedPdfUpload,
} from "../../src/lib/hvac/document-storage";
import {
  type TechnicalDocumentInput,
  technicalDocumentInputSchema,
} from "../../src/lib/hvac/document-validation";
import {
  DuplicateTechnicalDocumentError,
  TechnicalCatalogError,
  UploadReconciliationRequiredError,
} from "../../src/lib/hvac/errors";
import {
  createUploadReconciliationRecord,
  listUploadReconciliationRecords,
  readUploadReconciliationRecord,
  reconcileUploadOperation,
  updateUploadReconciliationRecord,
} from "../../src/lib/hvac/upload-reconciliation";

function file(
  content: string,
  overrides: Partial<DocumentFileLike> = {},
): DocumentFileLike {
  const bytes = new TextEncoder().encode(content);
  return {
    name: "manual.pdf",
    type: "application/pdf",
    size: bytes.byteLength,
    async arrayBuffer() {
      return bytes.slice().buffer;
    },
    ...overrides,
  };
}

function input(
  overrides: Partial<TechnicalDocumentInput> = {},
): TechnicalDocumentInput {
  return {
    title: "Manuel technique",
    type: TechnicalDocumentType.INSTALLATION_MANUAL,
    version: "",
    documentDate: null,
    isPrimary: false,
    active: true,
    equipmentIds: [],
    systemCombinationIds: [],
    ...overrides,
  };
}

function lookup(
  overrides: Partial<DocumentAssociationLookup> = {},
): DocumentAssociationLookup {
  const equipment = new Map([
    ["equipment-a", { id: "equipment-a", active: true }],
    ["equipment-b", { id: "equipment-b", active: true }],
  ]);
  const combinations = new Map([
    ["combination-a", { id: "combination-a", active: true }],
    ["combination-b", { id: "combination-b", active: true }],
  ]);
  return {
    async findEquipment(ids) {
      return ids.flatMap((id) => {
        const found = equipment.get(id);
        return found ? [found] : [];
      });
    },
    async findSystemCombinations(ids) {
      return ids.flatMap((id) => {
        const found = combinations.get(id);
        return found ? [found] : [];
      });
    },
    ...overrides,
  };
}

async function rejectsWithCode(
  promise: Promise<unknown>,
  code: TechnicalCatalogError["code"],
) {
  await assert.rejects(
    promise,
    (error) => error instanceof TechnicalCatalogError && error.code === code,
  );
}

test("a valid PDF is validated and ready for document creation", async () => {
  const validated = await validatePdfFile(file("%PDF-1.7\nmanual"));
  const events: string[] = [];
  const result = await persistUploadedDocument({
    async write() {
      events.push("write");
    },
    async persist() {
      events.push("persist");
      return { id: "document-a" };
    },
    async lookupPersisted() {
      events.push("lookup");
      return null;
    },
    async remove() {
      events.push("remove");
    },
    async record(result) {
      events.push(`record:${result.reconciliationState}`);
    },
  });
  assert.equal(validated.originalFileName, "manual.pdf");
  assert.equal(validated.mimeType, "application/pdf");
  assert.equal(result.id, "document-a");
  assert.deepEqual(events, [
    "write",
    "record:PENDING_DB",
    "persist",
    "record:COMMITTED",
  ]);
});

test("a non-PDF MIME type is rejected", async () => {
  await rejectsWithCode(
    validatePdfFile(file("%PDF-1.7", { type: "text/plain" })),
    "INVALID_FILE",
  );
});

test("a .pdf file with an invalid signature is rejected", async () => {
  await rejectsWithCode(
    validatePdfFile(file("not a real PDF")),
    "INVALID_FILE",
  );
});

test("a file above 25 MiB is rejected before reading content", async () => {
  let read = false;
  await rejectsWithCode(
    validatePdfFile(file("%PDF-", {
      size: MAX_TECHNICAL_DOCUMENT_BYTES + 1,
      async arrayBuffer() {
        read = true;
        return new ArrayBuffer(0);
      },
    })),
    "INVALID_FILE",
  );
  assert.equal(read, false);
});

test("storage names are server-generated, unique UUID PDF names", () => {
  const first = generateStorageName();
  const second = generateStorageName();
  assert.notEqual(first, second);
  assert.match(
    first,
    /^[0-9a-f-]{36}\.pdf$/i,
  );
});

test("SHA-256 is calculated from file contents", () => {
  assert.equal(
    calculateSha256(new TextEncoder().encode("abc")),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});

test("an existing checksum reports the existing document", async () => {
  await assert.rejects(
    assertUniqueDocumentChecksum({
      async findByChecksum() {
        return { id: "document-existing" };
      },
    }, "a".repeat(64)),
    (error) => (
      error instanceof DuplicateTechnicalDocumentError
      && error.documentId === "document-existing"
    ),
  );
});

test("one document may be associated with multiple equipment", async () => {
  const result = await validateDocumentAssociations(
    lookup(),
    input({ equipmentIds: ["equipment-a", "equipment-b"] }),
  );
  assert.deepEqual(result.equipmentIds, ["equipment-a", "equipment-b"]);
});

test("one document may be associated with multiple combinations", async () => {
  const result = await validateDocumentAssociations(
    lookup(),
    input({
      systemCombinationIds: ["combination-a", "combination-b"],
    }),
  );
  assert.deepEqual(
    result.systemCombinationIds,
    ["combination-a", "combination-b"],
  );
});

test("equipment and combinations may be associated simultaneously", async () => {
  const result = await validateDocumentAssociations(
    lookup(),
    input({
      equipmentIds: ["equipment-a"],
      systemCombinationIds: ["combination-a"],
    }),
  );
  assert.equal(result.equipmentIds.length, 1);
  assert.equal(result.systemCombinationIds.length, 1);
});

test("an unknown equipment ID is rejected", async () => {
  await rejectsWithCode(
    validateDocumentAssociations(
      lookup(),
      input({ equipmentIds: ["equipment-missing"] }),
    ),
    "INVALID_ASSOCIATION",
  );
});

test("an unknown combination ID is rejected", async () => {
  await rejectsWithCode(
    validateDocumentAssociations(
      lookup(),
      input({ systemCombinationIds: ["combination-missing"] }),
    ),
    "INVALID_ASSOCIATION",
  );
});

test("duplicate association rows are rejected before synchronization", () => {
  const result = technicalDocumentInputSchema.safeParse({
    ...input(),
    equipmentIds: ["equipment-a", "equipment-a"],
  });
  assert.equal(result.success, false);
});

test("deactivation changes only status and preserves associations", () => {
  const data = technicalDocumentStatusData(false);
  assert.deepEqual(data, { active: false });
  assert.equal("equipment" in data, false);
  assert.equal("systemCombinations" in data, false);
});

test("a newly written file is compensated if persistence fails", async () => {
  const events: string[] = [];
  const rollbackError = Object.assign(new Error("database rolled back"), {
    code: "P2034",
  });
  await assert.rejects(
    persistUploadedDocument({
      async write() {
        events.push("write");
      },
      async persist() {
        events.push("persist");
        throw rollbackError;
      },
      async lookupPersisted() {
        events.push("lookup");
        return null;
      },
      async remove() {
        events.push("remove");
      },
      async record(result) {
        events.push(`record:${result.reconciliationState}`);
      },
    }),
    /database rolled back/,
  );
  assert.deepEqual(events, [
    "write",
    "record:PENDING_DB",
    "persist",
    "lookup",
    "remove",
    "record:ROLLED_BACK",
  ]);
});

test("an ambiguous database result preserves an unreferenced file", async () => {
  const events: string[] = [];
  await assert.rejects(
    persistUploadedDocument({
      async write() {
        events.push("write");
      },
      async persist() {
        events.push("persist");
        throw Object.assign(new Error("connection lost"), {
          code: "P1001",
        });
      },
      async lookupPersisted() {
        events.push("lookup");
        return null;
      },
      async remove() {
        events.push("remove");
      },
      async record(result) {
        events.push(`record:${result.reconciliationState}`);
      },
    }),
    UploadReconciliationRequiredError,
  );
  assert.deepEqual(events, [
    "write",
    "record:PENDING_DB",
    "persist",
    "lookup",
    "record:AMBIGUOUS",
  ]);
});

test("a committed document wins over an ambiguous response", async () => {
  const events: string[] = [];
  const result = await persistUploadedDocument({
    async write() {
      events.push("write");
    },
    async persist() {
      events.push("persist");
      throw Object.assign(new Error("response lost"), { code: "P1002" });
    },
    async lookupPersisted() {
      events.push("lookup");
      return { id: "committed-document" };
    },
    async remove() {
      events.push("remove");
    },
    async record(result) {
      events.push(`record:${result.reconciliationState}`);
    },
  });
  assert.equal(result.id, "committed-document");
  assert.deepEqual(events, [
    "write",
    "record:PENDING_DB",
    "persist",
    "lookup",
    "record:COMMITTED",
  ]);
});

test("a reconciliation-record failure occurs before DB persistence and compensates the new file", async () => {
  const events: string[] = [];
  await assert.rejects(
    persistUploadedDocument({
      async write() {
        events.push("write");
      },
      async persist() {
        events.push("persist");
        return { id: "must-not-persist" };
      },
      async lookupPersisted() {
        events.push("lookup");
        return null;
      },
      async remove() {
        events.push("remove");
      },
      async record() {
        events.push("record");
        throw new Error("journal unavailable");
      },
    }),
    /journal unavailable/,
  );
  assert.deepEqual(events, ["write", "record", "remove"]);
});

test("streaming upload calculates SHA-256 incrementally and never leaves an invalid partial PDF", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "hvac-stream-test-"));
  const storageName = "22222222-2222-4222-8222-222222222222.pdf";
  const invalidName = "33333333-3333-4333-8333-333333333333.pdf";
  const chunks = [
    new TextEncoder().encode("%PD"),
    new TextEncoder().encode("F-1.7\n"),
    new TextEncoder().encode("streamed"),
  ];
  const bytes = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
  const streamedFile: DocumentFileLike = {
    name: "streamed.pdf",
    type: "application/pdf",
    size: bytes.byteLength,
    async arrayBuffer() {
      throw new Error("arrayBuffer must not be used when stream is available");
    },
    stream() {
      return new ReadableStream({
        start(controller) {
          for (const chunk of chunks) controller.enqueue(chunk);
          controller.close();
        },
      });
    },
  };
  try {
    const result = await writeValidatedPdfUpload(
      streamedFile,
      storageName,
      directory,
    );
    assert.equal(result.checksumSha256, calculateSha256(bytes));
    assert.equal(
      (await readFile(path.join(directory, storageName))).toString(),
      bytes.toString(),
    );

    await assert.rejects(
      writeValidatedPdfUpload(
        file("not-pdf", {
          stream() {
            return new ReadableStream({
              start(controller) {
                controller.enqueue(new TextEncoder().encode("not-pdf"));
                controller.close();
              },
            });
          },
        }),
        invalidName,
        directory,
      ),
      TechnicalCatalogError,
    );
    await assert.rejects(readFile(path.join(directory, invalidName)), {
      code: "ENOENT",
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("ambiguous upload evidence is persistent and reconciliation is idempotent", async () => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "hvac-reconciliation-test-"),
  );
  const operationId = "44444444-4444-4444-8444-444444444444";
  try {
    await createUploadReconciliationRecord({
      storageName: "55555555-5555-4555-8555-555555555555.pdf",
      logicalDocumentName: "Manual",
      checksumSha256: "a".repeat(64),
      sizeBytes: 123,
      mimeType: "application/pdf",
      actorId: "admin-a",
    }, { operationId, storageRoot: directory });
    await updateUploadReconciliationRecord(operationId, {
      databaseCheck: "CHECK_FAILED",
      ambiguityReason: "connection lost",
      reconciliationState: "AMBIGUOUS",
    }, { storageRoot: directory });
    const ambiguous = await readUploadReconciliationRecord(
      operationId,
      directory,
    );
    assert.equal(ambiguous.reconciliationState, "AMBIGUOUS");
    assert.equal(ambiguous.storageName, "55555555-5555-4555-8555-555555555555.pdf");
    assert.equal("physicalPath" in ambiguous, false);

    let checks = 0;
    const reconciled = await reconcileUploadOperation(
      operationId,
      async () => {
        checks += 1;
        return { id: "document-a" };
      },
      { storageRoot: directory },
    );
    assert.equal(reconciled.reconciliationState, "COMMITTED");
    const repeated = await reconcileUploadOperation(
      operationId,
      async () => {
        checks += 1;
        return null;
      },
      { storageRoot: directory },
    );
    assert.equal(repeated.reconciliationState, "COMMITTED");
    assert.equal(checks, 1);
    assert.equal((await listUploadReconciliationRecords(directory)).length, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("path traversal and arbitrary storage names are rejected", () => {
  assert.throws(
    () => resolveTechnicalDocumentPath("../secret.pdf", "/tmp/documents"),
    (error) => (
      error instanceof TechnicalCatalogError
      && error.code === "INVALID_FILE"
    ),
  );
  assert.throws(
    () => resolveTechnicalDocumentPath("manual.pdf", "/tmp/documents"),
    TechnicalCatalogError,
  );
});

test("storage writes with exclusive creation and removes only its file", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "hvac-doc-test-"));
  const storageName = "11111111-1111-4111-8111-111111111111.pdf";
  try {
    await writeTechnicalDocumentFile(
      storageName,
      new TextEncoder().encode("%PDF-1.7"),
      directory,
    );
    assert.equal(
      (await readFile(path.join(directory, storageName))).toString(),
      "%PDF-1.7",
    );
    await assert.rejects(
      writeTechnicalDocumentFile(
        storageName,
        new TextEncoder().encode("%PDF-1.7"),
        directory,
      ),
      (error) => (
        error
        && typeof error === "object"
        && "code" in error
        && error.code === "EEXIST"
      ),
    );
    assert.equal(
      await removeTechnicalDocumentFile(storageName, directory),
      true,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("only ADMIN mutates while authenticated operators and viewers can read", () => {
  assert.equal(canManageTechnicalCatalog("ADMIN"), true);
  assert.equal(canManageTechnicalCatalog("OPERATOR"), false);
  assert.equal(canManageTechnicalCatalog("VIEWER"), false);
  assert.equal(canReadTechnicalDocuments("ADMIN"), true);
  assert.equal(canReadTechnicalDocuments("OPERATOR"), true);
  assert.equal(canReadTechnicalDocuments("VIEWER"), true);
  assert.equal(canReadTechnicalDocuments(null), false);
});
