import "server-only";

import { randomUUID } from "node:crypto";
import type { TechnicalDocumentInput } from "@/lib/hvac/document-validation";
import {
  generateStorageName,
  type DocumentFileLike,
} from "@/lib/hvac/document-file";
import {
  createTechnicalDocumentRecord,
  findTechnicalDocumentByChecksum,
  findTechnicalDocumentByStorageName,
  findTechnicalDocumentsWithoutChecksum,
} from "@/lib/hvac/document-repository";
import { persistUploadedDocument } from "@/lib/hvac/document-service";
import {
  checksumStoredTechnicalDocument,
  removeTechnicalDocumentFile,
  writeValidatedPdfUpload,
} from "@/lib/hvac/document-storage";
import { DuplicateTechnicalDocumentError } from "@/lib/hvac/errors";
import {
  createUploadReconciliationRecord,
  updateUploadReconciliationRecord,
} from "@/lib/hvac/upload-reconciliation";

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
  const storageName = generateStorageName();
  const operationId = randomUUID();
  const uploadState: {
    validatedFile?: Awaited<ReturnType<typeof writeValidatedPdfUpload>>;
  } = {};
  try {
    return await persistUploadedDocument({
      write: async () => {
        uploadState.validatedFile = await writeValidatedPdfUpload(
          file,
          storageName,
        );
      },
      persist: async () => {
        const validatedFile = uploadState.validatedFile;
        if (!validatedFile) {
          throw new Error("Validated upload metadata is unavailable.");
        }
        const existing = await findTechnicalDocumentByChecksum(
          validatedFile.checksumSha256,
        ) || await findLegacyDuplicate(validatedFile.checksumSha256);
        if (existing) throw new DuplicateTechnicalDocumentError(existing.id);
        return createTechnicalDocumentRecord(
          input,
          validatedFile,
          userId,
        ).then((document) => ({ id: document.id }));
      },
      lookupPersisted: () => findTechnicalDocumentByStorageName(storageName),
      remove: () => removeTechnicalDocumentFile(storageName).then(
        () => undefined,
      ),
      record: async (result) => {
        const validatedFile = uploadState.validatedFile;
        if (!validatedFile) {
          throw new Error("Validated upload metadata is unavailable.");
        }
        if (result.reconciliationState === "PENDING_DB") {
          await createUploadReconciliationRecord({
            storageName,
            logicalDocumentName: input.title,
            checksumSha256: validatedFile.checksumSha256,
            sizeBytes: validatedFile.sizeBytes,
            mimeType: validatedFile.mimeType,
            actorId: userId,
          }, { operationId });
          return;
        }
        await updateUploadReconciliationRecord(operationId, result);
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const validatedFile = uploadState.validatedFile;
      if (!validatedFile) throw error;
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
