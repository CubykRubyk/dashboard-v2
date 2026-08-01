import "server-only";

import type { TechnicalDocumentInput } from "@/lib/hvac/document-validation";
import {
  generateStorageName,
  type DocumentFileLike,
  validatePdfFile,
} from "@/lib/hvac/document-file";
import {
  createTechnicalDocumentRecord,
  findTechnicalDocumentByChecksum,
  findTechnicalDocumentsWithoutChecksum,
} from "@/lib/hvac/document-repository";
import { persistUploadedDocument } from "@/lib/hvac/document-service";
import {
  checksumStoredTechnicalDocument,
  removeTechnicalDocumentFile,
  writeTechnicalDocumentFile,
} from "@/lib/hvac/document-storage";
import { DuplicateTechnicalDocumentError } from "@/lib/hvac/errors";

async function findLegacyDuplicate(checksumSha256: string) {
  const documents = await findTechnicalDocumentsWithoutChecksum();
  for (const document of documents) {
    try {
      const storedChecksum = await checksumStoredTechnicalDocument(
        document.storageName,
      );
      if (storedChecksum === checksumSha256) return document;
    } catch {
      // A missing or invalid legacy file is reported on its detail page. It
      // must not prevent unrelated uploads from using the library.
    }
  }
  return null;
}

function isUniqueConstraintError(error: unknown) {
  return Boolean(
    error
    && typeof error === "object"
    && "code" in error
    && error.code === "P2002",
  );
}

export async function uploadTechnicalDocument(
  file: DocumentFileLike,
  input: TechnicalDocumentInput,
  userId: string,
) {
  const validatedFile = await validatePdfFile(file);
  const existing = await findTechnicalDocumentByChecksum(
    validatedFile.checksumSha256,
  ) || await findLegacyDuplicate(validatedFile.checksumSha256);
  if (existing) throw new DuplicateTechnicalDocumentError(existing.id);

  const storageName = generateStorageName();
  try {
    return await persistUploadedDocument({
      write: () => writeTechnicalDocumentFile(
        storageName,
        validatedFile.buffer,
      ).then(() => undefined),
      persist: () => createTechnicalDocumentRecord(
        input,
        {
          originalFileName: validatedFile.originalFileName,
          storageName,
          checksumSha256: validatedFile.checksumSha256,
          mimeType: validatedFile.mimeType,
          sizeBytes: validatedFile.sizeBytes,
        },
        userId,
      ),
      remove: () => removeTechnicalDocumentFile(storageName).then(
        () => undefined,
      ),
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const concurrent = await findTechnicalDocumentByChecksum(
        validatedFile.checksumSha256,
      );
      if (concurrent) {
        throw new DuplicateTechnicalDocumentError(concurrent.id);
      }
    }
    throw error;
  }
}
