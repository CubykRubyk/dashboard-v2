import { constants } from "node:fs";
import {
  access,
  mkdir,
  readFile,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import {
  calculateSha256,
  generateStorageName,
  TECHNICAL_DOCUMENT_MIME_TYPE,
  validatePdfFile,
  type DocumentFileLike,
} from "@/lib/hvac/document-file";
import { DocumentError } from "@/lib/documents/errors";

const STORAGE_NAME_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/i;

function storageRoot(envVar: string, fallbackDir: string) {
  const configured = process.env[envVar]?.trim();
  if (process.env.NODE_ENV === "production" && !configured) {
    throw new Error(`${envVar} doit être configuré en production.`);
  }
  return path.resolve(
    /* turbopackIgnore: true */
    configured || path.join(/* turbopackIgnore: true */ process.cwd(), "data", fallbackDir),
  );
}

export function documentTemplateStorageRoot() {
  return storageRoot("DOCUMENT_TEMPLATE_STORAGE_ROOT", "document-templates");
}

export function generatedDocumentStorageRoot() {
  return storageRoot("GENERATED_DOCUMENT_STORAGE_ROOT", "generated-documents");
}

export async function assertDocumentStorageReady(root: string) {
  const resolved = path.resolve(/* turbopackIgnore: true */ root);
  await mkdir(resolved, { recursive: true, mode: 0o750 });
  await access(resolved, constants.R_OK | constants.W_OK);
  return resolved;
}

export function resolveDocumentPath(storageName: string, root: string) {
  if (!STORAGE_NAME_PATTERN.test(storageName)) {
    throw new DocumentError("L'identifiant interne du fichier est invalide.", "INVALID_FILE");
  }
  const resolvedRoot = path.resolve(/* turbopackIgnore: true */ root);
  const resolved = path.resolve(/* turbopackIgnore: true */ resolvedRoot, storageName);
  if (path.dirname(resolved) !== resolvedRoot) {
    throw new DocumentError("Le chemin du fichier est invalide.", "INVALID_FILE");
  }
  return resolved;
}

export async function writeValidatedPdf(
  file: DocumentFileLike,
  root: string,
) {
  let validated;
  try {
    validated = await validatePdfFile(file);
  } catch (error) {
    if (error instanceof Error) {
      throw new DocumentError(error.message, "INVALID_FILE");
    }
    throw error;
  }
  const storageName = generateStorageName();
  const destination = resolveDocumentPath(storageName, await assertDocumentStorageReady(root));
  await writeFile(destination, validated.buffer, { flag: "wx", mode: 0o640 });
  return {
    storageName,
    originalFileName: validated.originalFileName,
    checksumSha256: validated.checksumSha256,
    mimeType: validated.mimeType,
    sizeBytes: validated.sizeBytes,
  };
}

export async function writeGeneratedPdf(content: Uint8Array, root: string) {
  const storageName = generateStorageName();
  const destination = resolveDocumentPath(storageName, await assertDocumentStorageReady(root));
  await writeFile(destination, content, { flag: "wx", mode: 0o640 });
  return {
    storageName,
    checksumSha256: calculateSha256(content),
    sizeBytes: content.byteLength,
    mimeType: TECHNICAL_DOCUMENT_MIME_TYPE,
  };
}

export async function readDocumentFile(storageName: string, root: string) {
  await assertDocumentStorageReady(root);
  try {
    return await readFile(resolveDocumentPath(storageName, root));
  } catch {
    throw new DocumentError("Le fichier est introuvable sur le disque.", "FILE_NOT_FOUND");
  }
}

export async function removeDocumentFile(storageName: string, root: string) {
  await unlink(resolveDocumentPath(storageName, root)).catch(() => undefined);
}
