import { constants } from "node:fs";
import { access, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";

import { DocumentError } from "@/lib/documents/errors";

export const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_TICKET = 20;

// Photos (HEIC/HEIF inclus : format par défaut de l'appareil photo iPhone, cf. photo-storage.ts)
// et documents — une société cliente joint souvent un devis ou un rapport, pas seulement des photos.
const ALLOWED_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/heic": ".heic",
  "image/heif": ".heif",
  "application/pdf": ".pdf",
};

const STORAGE_NAME_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|heic|heif|pdf)$/i;

export function attachmentStorageRoot() {
  const configured = process.env.SAV_ATTACHMENT_STORAGE_ROOT?.trim();
  if (process.env.NODE_ENV === "production" && !configured) {
    throw new Error("SAV_ATTACHMENT_STORAGE_ROOT doit être configuré en production.");
  }
  return path.resolve(
    /* turbopackIgnore: true */
    configured || path.join(/* turbopackIgnore: true */ process.cwd(), "data", "sav-attachments"),
  );
}

async function ensureRoot() {
  const resolved = path.resolve(/* turbopackIgnore: true */ attachmentStorageRoot());
  await mkdir(resolved, { recursive: true, mode: 0o750 });
  await access(resolved, constants.R_OK | constants.W_OK);
  return resolved;
}

export function resolveAttachmentPath(storageName: string, root: string) {
  if (!STORAGE_NAME_PATTERN.test(storageName)) {
    throw new DocumentError("L’identifiant interne du fichier est invalide.", "INVALID_FILE");
  }
  const resolvedRoot = path.resolve(/* turbopackIgnore: true */ root);
  const resolved = path.resolve(/* turbopackIgnore: true */ resolvedRoot, storageName);
  // Défense en profondeur contre un `..` qui aurait passé le motif ci-dessus.
  if (path.dirname(resolved) !== resolvedRoot) {
    throw new DocumentError("Le chemin du fichier est invalide.", "INVALID_FILE");
  }
  return resolved;
}

export interface StoredAttachment {
  storageName: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
}

export interface AttachmentFileLike {
  name: string;
  type: string;
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export async function writeAttachment(file: AttachmentFileLike): Promise<StoredAttachment> {
  const extension = ALLOWED_MIME[file.type];
  if (!extension) {
    throw new DocumentError(
      "Format non pris en charge (images et PDF uniquement).",
      "INVALID_FILE",
    );
  }
  if (file.size <= 0 || file.size > MAX_ATTACHMENT_BYTES) {
    throw new DocumentError("Le fichier est vide ou dépasse 15 Mo.", "INVALID_FILE");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  // Un PDF annoncé comme tel doit commencer par `%PDF-` : le type MIME est déclaré par le client,
  // il ne prouve rien (même vérification que pour les documents techniques).
  if (file.type === "application/pdf" && buffer.subarray(0, 5).toString() !== "%PDF-") {
    throw new DocumentError("Ce fichier n’est pas un PDF valide.", "INVALID_FILE");
  }

  const originalFileName = file.name.normalize("NFC").trim().slice(0, 255) || `piece${extension}`;
  if (originalFileName.includes("/") || originalFileName.includes("\\")) {
    throw new DocumentError("Le nom du fichier est invalide.", "INVALID_FILE");
  }

  const storageName = `${randomUUID()}${extension}`;
  const destination = resolveAttachmentPath(storageName, await ensureRoot());
  await writeFile(destination, buffer, { flag: "wx", mode: 0o640 });

  return {
    storageName,
    originalFileName,
    mimeType: file.type,
    sizeBytes: buffer.byteLength,
    checksumSha256: createHash("sha256").update(buffer).digest("hex"),
  };
}

export async function readAttachment(storageName: string) {
  const root = await ensureRoot();
  try {
    return await readFile(resolveAttachmentPath(storageName, root));
  } catch {
    throw new DocumentError("Le fichier est introuvable sur le disque.", "FILE_NOT_FOUND");
  }
}

export async function removeAttachment(storageName: string) {
  const root = attachmentStorageRoot();
  await unlink(resolveAttachmentPath(storageName, root)).catch(() => undefined);
}
