import { createHash, randomUUID } from "node:crypto";
import { extname } from "node:path";
import { TechnicalCatalogError } from "@/lib/hvac/errors";

export const MAX_TECHNICAL_DOCUMENT_BYTES = 25 * 1024 * 1024;
export const TECHNICAL_DOCUMENT_MIME_TYPE = "application/pdf";

export interface DocumentFileLike {
  name: string;
  type: string;
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface ValidatedPdfFile {
  buffer: Buffer;
  checksumSha256: string;
  originalFileName: string;
  mimeType: typeof TECHNICAL_DOCUMENT_MIME_TYPE;
  sizeBytes: number;
}

function validateOriginalFileName(name: string) {
  const normalized = name.normalize("NFC").trim();
  if (
    !normalized
    || normalized.length > 255
    || normalized.includes("/")
    || normalized.includes("\\")
    || /[\u0000-\u001f\u007f]/.test(normalized)
  ) {
    throw new TechnicalCatalogError(
      "Le nom original du fichier est invalide.",
      "INVALID_FILE",
    );
  }
  if (extname(normalized).toLowerCase() !== ".pdf") {
    throw new TechnicalCatalogError(
      "Le fichier doit porter l’extension .pdf.",
      "INVALID_FILE",
    );
  }
  return normalized;
}

export function calculateSha256(content: Uint8Array) {
  return createHash("sha256").update(content).digest("hex");
}

export function generateStorageName(
  uuid: () => string = randomUUID,
) {
  return `${uuid()}.pdf`;
}

export async function validatePdfFile(
  file: DocumentFileLike | null | undefined,
): Promise<ValidatedPdfFile> {
  if (!file || file.size <= 0) {
    throw new TechnicalCatalogError(
      "Sélectionnez un fichier PDF.",
      "INVALID_FILE",
    );
  }
  if (file.size > MAX_TECHNICAL_DOCUMENT_BYTES) {
    throw new TechnicalCatalogError(
      "Le document doit être un PDF de 25 Mo maximum.",
      "INVALID_FILE",
    );
  }
  if (file.type !== TECHNICAL_DOCUMENT_MIME_TYPE) {
    throw new TechnicalCatalogError(
      "Le type MIME du fichier doit être application/pdf.",
      "INVALID_FILE",
    );
  }
  const originalFileName = validateOriginalFileName(file.name);
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.byteLength !== file.size) {
    throw new TechnicalCatalogError(
      "La taille reçue du fichier est incohérente.",
      "INVALID_FILE",
    );
  }
  if (
    buffer.byteLength < 5
    || buffer.subarray(0, 5).toString("ascii") !== "%PDF-"
  ) {
    throw new TechnicalCatalogError(
      "Le contenu du fichier ne possède pas une signature PDF valide.",
      "INVALID_FILE",
    );
  }

  return {
    buffer,
    checksumSha256: calculateSha256(buffer),
    originalFileName,
    mimeType: TECHNICAL_DOCUMENT_MIME_TYPE,
    sizeBytes: buffer.byteLength,
  };
}
