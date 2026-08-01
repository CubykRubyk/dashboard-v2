import { constants } from "node:fs";
import { createHash } from "node:crypto";
import {
  access,
  mkdir,
  open,
  readFile,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import {
  calculateSha256,
  MAX_TECHNICAL_DOCUMENT_BYTES,
  type DocumentFileLike,
  validatePdfFileMetadata,
} from "@/lib/hvac/document-file";
import { TechnicalCatalogError } from "@/lib/hvac/errors";

const STORAGE_NAME_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/i;

export function technicalDocumentStorageRoot() {
  const configured = process.env.TECHNICAL_DOCUMENT_STORAGE_ROOT?.trim();
  if (process.env.NODE_ENV === "production" && !configured) {
    throw new Error(
      "TECHNICAL_DOCUMENT_STORAGE_ROOT doit être configuré en production.",
    );
  }
  return path.resolve(
    /* turbopackIgnore: true */
    configured || path.join(
      /* turbopackIgnore: true */ process.cwd(),
      "data",
      "pac-documents",
    ),
  );
}

function mountPoints(mountInfo: string) {
  return mountInfo
    .split("\n")
    .map((line) => line.trim().split(" "))
    .filter((fields) => fields.length > 5)
    .map((fields) => fields[4].replaceAll("\\040", " "));
}

export async function assertTechnicalDocumentStorageReady(
  storageRoot = technicalDocumentStorageRoot(),
) {
  const root = path.resolve(/* turbopackIgnore: true */ storageRoot);
  await mkdir(root, { recursive: true, mode: 0o750 });
  await access(root, constants.R_OK | constants.W_OK);

  if (
    process.env.NODE_ENV === "production"
    && process.env.TECHNICAL_DOCUMENT_STORAGE_REQUIRE_MOUNT !== "true"
  ) {
    throw new Error(
      "TECHNICAL_DOCUMENT_STORAGE_REQUIRE_MOUNT doit être activé en production.",
    );
  }
  if (
    process.env.NODE_ENV === "production"
    && process.env.TECHNICAL_DOCUMENT_STORAGE_REQUIRE_MOUNT === "true"
  ) {
    let info: string;
    try {
      info = await readFile("/proc/self/mountinfo", "utf8");
    } catch {
      throw new Error(
        "Le volume documentaire obligatoire ne peut pas être vérifié.",
      );
    }
    if (!mountPoints(info).includes(root)) {
      throw new Error(
        `Le volume documentaire obligatoire n’est pas monté sur ${root}.`,
      );
    }
  }
  return root;
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
  const root = path.resolve(/* turbopackIgnore: true */ storageRoot);
  const resolved = path.resolve(
    /* turbopackIgnore: true */ root,
    storageName,
  );
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
  await assertTechnicalDocumentStorageReady(storageRoot);
  await writeFile(destination, content, { flag: "wx", mode: 0o640 });
  return destination;
}

export async function writeValidatedPdfUpload(
  file: DocumentFileLike,
  storageName: string,
  storageRoot = technicalDocumentStorageRoot(),
) {
  const metadata = validatePdfFileMetadata(file);
  const destination = resolveTechnicalDocumentPath(storageName, storageRoot);
  await assertTechnicalDocumentStorageReady(storageRoot);
  const handle = await open(destination, "wx", 0o640);
  let completed = false;
  try {
    const hash = createHash("sha256");
    let sizeBytes = 0;
    let signature = Buffer.alloc(0);
    const source = file.stream?.();
    const chunks: AsyncIterable<Uint8Array> = source
      ? source as unknown as AsyncIterable<Uint8Array>
      : (async function* fallback() {
          yield new Uint8Array(await file.arrayBuffer());
        })();

    for await (const chunk of chunks) {
      const bytes = Buffer.from(chunk);
      sizeBytes += bytes.byteLength;
      if (sizeBytes > MAX_TECHNICAL_DOCUMENT_BYTES) {
        throw new TechnicalCatalogError(
          "Le document doit être un PDF de 25 Mo maximum.",
          "INVALID_FILE",
        );
      }
      if (signature.byteLength < 5) {
        signature = Buffer.concat([
          signature,
          bytes.subarray(0, 5 - signature.byteLength),
        ]);
      }
      hash.update(bytes);
      let offset = 0;
      while (offset < bytes.byteLength) {
        const { bytesWritten } = await handle.write(
          bytes,
          offset,
          bytes.byteLength - offset,
          null,
        );
        if (bytesWritten <= 0) {
          throw new Error("The uploaded PDF could not be written completely.");
        }
        offset += bytesWritten;
      }
    }
    if (sizeBytes !== metadata.sizeBytes) {
      throw new TechnicalCatalogError(
        "La taille reçue du fichier est incohérente.",
        "INVALID_FILE",
      );
    }
    if (
      signature.byteLength < 5
      || signature.toString("ascii") !== "%PDF-"
    ) {
      throw new TechnicalCatalogError(
        "Le contenu du fichier ne possède pas une signature PDF valide.",
        "INVALID_FILE",
      );
    }
    await handle.sync();
    completed = true;
    return {
      originalFileName: metadata.originalFileName,
      storageName,
      checksumSha256: hash.digest("hex"),
      mimeType: metadata.mimeType,
      sizeBytes,
    };
  } finally {
    await handle.close();
    if (!completed) {
      await unlink(destination).catch(() => undefined);
    }
  }
}

export async function readTechnicalDocumentFile(
  storageName: string,
  storageRoot = technicalDocumentStorageRoot(),
) {
  await assertTechnicalDocumentStorageReady(storageRoot);
  return readFile(
    /* turbopackIgnore: true */
    resolveTechnicalDocumentPath(storageName, storageRoot),
  );
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
