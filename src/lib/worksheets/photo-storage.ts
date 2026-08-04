import "server-only";

import { constants } from "node:fs";
import { access, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { DocumentError } from "@/lib/documents/errors";

export const MAX_PHOTO_BYTES = 12 * 1024 * 1024;

// HEIC/HEIF : format par défaut de l'appareil photo iPhone — refusé silencieusement si on ne
// l'accepte pas, d'où sa présence ici même si le navigateur ne sait pas toujours l'afficher.
const ALLOWED_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/heic": ".heic",
  "image/heif": ".heif",
};

const STORAGE_NAME_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|heic|heif)$/i;

export function photoStorageRoot() {
  const configured = process.env.INTERVENTION_PHOTO_STORAGE_ROOT?.trim();
  if (process.env.NODE_ENV === "production" && !configured) {
    throw new Error("INTERVENTION_PHOTO_STORAGE_ROOT doit être configuré en production.");
  }
  return path.resolve(
    /* turbopackIgnore: true */
    configured || path.join(/* turbopackIgnore: true */ process.cwd(), "data", "intervention-photos"),
  );
}

async function ensureRoot() {
  const resolved = path.resolve(/* turbopackIgnore: true */ photoStorageRoot());
  await mkdir(resolved, { recursive: true, mode: 0o750 });
  await access(resolved, constants.R_OK | constants.W_OK);
  return resolved;
}

export function resolvePhotoPath(storageName: string, root: string) {
  if (!STORAGE_NAME_PATTERN.test(storageName)) {
    throw new DocumentError("L'identifiant interne du fichier est invalide.", "INVALID_FILE");
  }
  const resolvedRoot = path.resolve(/* turbopackIgnore: true */ root);
  const resolved = path.resolve(/* turbopackIgnore: true */ resolvedRoot, storageName);
  // Défense en profondeur contre un `..` qui aurait passé le motif ci-dessus.
  if (path.dirname(resolved) !== resolvedRoot) {
    throw new DocumentError("Le chemin du fichier est invalide.", "INVALID_FILE");
  }
  return resolved;
}

export interface StoredPhoto {
  storageName: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
}

export async function writePhoto(file: File): Promise<StoredPhoto> {
  const extension = ALLOWED_MIME[file.type];
  if (!extension) {
    throw new DocumentError("Format d'image non pris en charge.", "INVALID_FILE");
  }
  if (file.size <= 0 || file.size > MAX_PHOTO_BYTES) {
    throw new DocumentError("L'image est vide ou trop volumineuse (12 Mo max).", "INVALID_FILE");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const originalFileName = file.name.normalize("NFC").trim().slice(0, 255) || `photo${extension}`;
  if (originalFileName.includes("/") || originalFileName.includes("\\")) {
    throw new DocumentError("Le nom du fichier est invalide.", "INVALID_FILE");
  }

  const storageName = `${randomUUID()}${extension}`;
  const destination = resolvePhotoPath(storageName, await ensureRoot());
  await writeFile(destination, buffer, { flag: "wx", mode: 0o640 });

  return {
    storageName,
    originalFileName,
    mimeType: file.type,
    sizeBytes: buffer.byteLength,
    checksumSha256: createHash("sha256").update(buffer).digest("hex"),
  };
}

export async function readPhoto(storageName: string) {
  const root = await ensureRoot();
  try {
    return await readFile(resolvePhotoPath(storageName, root));
  } catch {
    throw new DocumentError("Le fichier est introuvable sur le disque.", "FILE_NOT_FOUND");
  }
}

export async function removePhoto(storageName: string) {
  const root = photoStorageRoot();
  await unlink(resolvePhotoPath(storageName, root)).catch(() => undefined);
}
