import { constants } from "node:fs";
import {
  access,
  mkdir,
  readFile,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { calculateSha256 } from "@/lib/hvac/document-file";
import { TechnicalCatalogError } from "@/lib/hvac/errors";

const STORAGE_NAME_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/i;

export function technicalDocumentStorageRoot() {
  return path.resolve(
    path.join(process.cwd(), "data", "pac-documents"),
  );
}

export function resolveTechnicalDocumentPath(
  storageName: string,
  storageRoot = technicalDocumentStorageRoot(),
) {
  if (!STORAGE_NAME_PATTERN.test(storageName)) {
    throw new TechnicalCatalogError(
      "L’identifiant interne du fichier est invalide.",
      "INVALID_FILE",
    );
  }
  const root = path.resolve(storageRoot);
  const resolved = path.resolve(root, storageName);
  if (path.dirname(resolved) !== root) {
    throw new TechnicalCatalogError(
      "Le chemin du fichier est invalide.",
      "INVALID_FILE",
    );
  }
  return resolved;
}

export async function writeTechnicalDocumentFile(
  storageName: string,
  content: Uint8Array,
  storageRoot = technicalDocumentStorageRoot(),
) {
  const destination = resolveTechnicalDocumentPath(storageName, storageRoot);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, content, { flag: "wx", mode: 0o640 });
  return destination;
}

export async function readTechnicalDocumentFile(
  storageName: string,
  storageRoot = technicalDocumentStorageRoot(),
) {
  return readFile(resolveTechnicalDocumentPath(storageName, storageRoot));
}

export async function technicalDocumentFileExists(
  storageName: string,
  storageRoot = technicalDocumentStorageRoot(),
) {
  try {
    await access(
      resolveTechnicalDocumentPath(storageName, storageRoot),
      constants.R_OK,
    );
    return true;
  } catch (error) {
    if (
      error
      && typeof error === "object"
      && "code" in error
      && error.code === "ENOENT"
    ) {
      return false;
    }
    if (error instanceof TechnicalCatalogError) throw error;
    return false;
  }
}

export async function checksumStoredTechnicalDocument(
  storageName: string,
  storageRoot = technicalDocumentStorageRoot(),
) {
  return calculateSha256(
    await readTechnicalDocumentFile(storageName, storageRoot),
  );
}

export async function removeTechnicalDocumentFile(
  storageName: string,
  storageRoot = technicalDocumentStorageRoot(),
) {
  const target = resolveTechnicalDocumentPath(storageName, storageRoot);
  try {
    await unlink(target);
    return true;
  } catch (error) {
    if (
      error
      && typeof error === "object"
      && "code" in error
      && error.code === "ENOENT"
    ) {
      return false;
    }
    throw error;
  }
}
