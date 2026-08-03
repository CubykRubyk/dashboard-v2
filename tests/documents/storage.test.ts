import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { DocumentError } from "../../src/lib/documents/errors";
import {
  readDocumentFile,
  removeDocumentFile,
  resolveDocumentPath,
  writeGeneratedPdf,
  writeValidatedPdf,
} from "../../src/lib/documents/storage";
import type { DocumentFileLike } from "../../src/lib/hvac/document-file";

function file(content: string): DocumentFileLike {
  const bytes = new TextEncoder().encode(content);
  return {
    name: "document.pdf",
    type: "application/pdf",
    size: bytes.byteLength,
    async arrayBuffer() {
      return bytes.slice().buffer;
    },
  };
}

async function withTempRoot(run: (root: string) => Promise<void>) {
  const root = await mkdtemp(path.join(os.tmpdir(), "documents-storage-test-"));
  try {
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("resolveDocumentPath accepts a well-formed generated storage name", async () => {
  await withTempRoot(async (root) => {
    const name = "3fa85f64-5717-4562-b3fc-2c963f66afa6.pdf";
    const resolved = resolveDocumentPath(name, root);
    assert.equal(resolved, path.join(path.resolve(root), name));
  });
});

test("resolveDocumentPath rejects names that don't match the expected UUID.pdf pattern", async () => {
  await withTempRoot(async (root) => {
    assert.throws(() => resolveDocumentPath("not-a-uuid.pdf", root), DocumentError);
    assert.throws(() => resolveDocumentPath("3fa85f64-5717-4562-b3fc-2c963f66afa6.txt", root), DocumentError);
  });
});

test("resolveDocumentPath rejects path traversal even when the segment matches the UUID pattern superficially", async () => {
  await withTempRoot(async (root) => {
    assert.throws(
      () => resolveDocumentPath("../3fa85f64-5717-4562-b3fc-2c963f66afa6.pdf", root),
      DocumentError,
    );
  });
});

test("writeValidatedPdf writes a valid PDF to disk and returns its checksum, then readDocumentFile round-trips the same bytes", async () => {
  await withTempRoot(async (root) => {
    const written = await writeValidatedPdf(file("%PDF-1.7\nhello"), root);
    assert.match(written.storageName, /\.pdf$/);
    assert.equal(written.mimeType, "application/pdf");
    const readBack = await readDocumentFile(written.storageName, root);
    assert.equal(readBack.toString("utf8"), "%PDF-1.7\nhello");
  });
});

test("writeValidatedPdf rejects a file whose bytes don't start with the PDF signature", async () => {
  await withTempRoot(async (root) => {
    await assert.rejects(writeValidatedPdf(file("not a pdf at all"), root), DocumentError);
  });
});

test("writeGeneratedPdf writes raw bytes (no PDF-signature validation) and reports a matching checksum/size", async () => {
  await withTempRoot(async (root) => {
    const content = new TextEncoder().encode("%PDF-1.7\ngenerated");
    const written = await writeGeneratedPdf(content, root);
    assert.equal(written.sizeBytes, content.byteLength);
    const readBack = await readDocumentFile(written.storageName, root);
    assert.deepEqual(new Uint8Array(readBack), content);
  });
});

test("readDocumentFile raises FILE_NOT_FOUND for a well-formed name that was never written", async () => {
  await withTempRoot(async (root) => {
    await assert.rejects(
      readDocumentFile("3fa85f64-5717-4562-b3fc-2c963f66afa6.pdf", root),
      (error: unknown) => error instanceof DocumentError && error.code === "FILE_NOT_FOUND",
    );
  });
});

test("removeDocumentFile deletes an existing file and is a silent no-op for a missing one", async () => {
  await withTempRoot(async (root) => {
    const written = await writeGeneratedPdf(new TextEncoder().encode("%PDF-1.7\nx"), root);
    await removeDocumentFile(written.storageName, root);
    await assert.rejects(readDocumentFile(written.storageName, root), DocumentError);
    await removeDocumentFile(written.storageName, root);
  });
});
