import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export const MAX_TEMPLATE_BYTES = 25 * 1024 * 1024;

export function generatedStorageRoot() {
  return path.resolve(
    /* turbopackIgnore: true */
    process.env.GENERATED_DOCUMENT_STORAGE_ROOT || path.join(
      /* turbopackIgnore: true */ process.cwd(),
      ".data",
      "generated-documents",
    ),
  );
}

function safePath(storageName: string) {
  if (!/^[a-f0-9-]+\.pdf$/i.test(storageName)) throw new Error("Nom de stockage invalide.");
  const root = generatedStorageRoot();
  const target = path.resolve(/* turbopackIgnore: true */ root, storageName);
  if (!target.startsWith(`${root}${path.sep}`)) throw new Error("Chemin de stockage invalide.");
  return target;
}

export function pdfStorageName() {
  return `${randomUUID()}.pdf`;
}

export function sha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function isPdfSignature(bytes: Uint8Array) {
  return new TextDecoder().decode(bytes.subarray(0, 5)) === "%PDF-";
}

export async function writeNewPdf(storageName: string, bytes: Uint8Array) {
  const target = safePath(storageName);
  const root = generatedStorageRoot();
  await mkdir(root, { recursive: true });
  const temporary = `${target}.${randomUUID()}.tmp`;
  await writeFile(temporary, bytes, { flag: "wx" });
  await rename(temporary, target);
  return target;
}

export async function removeOwnedPdf(storageName: string) {
  await rm(safePath(storageName), { force: true });
}

export async function readPdf(storageName: string) {
  return readFile(safePath(storageName));
}
