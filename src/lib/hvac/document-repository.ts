import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import {
  type DocumentAssociationLookup,
  technicalDocumentMetadata,
  technicalDocumentStatusData,
  validateDocumentAssociations,
} from "@/lib/hvac/document-service";
import type { TechnicalDocumentInput } from "@/lib/hvac/document-validation";
import {
  DuplicateTechnicalDocumentError,
  TechnicalCatalogError,
} from "@/lib/hvac/errors";
import { prisma } from "@/lib/prisma";

type Transaction = Prisma.TransactionClient;

export interface TechnicalDocumentFileMetadata {
  originalFileName: string;
  storageName: string;
  checksumSha256: string;
  mimeType: string;
  sizeBytes: number;
}

function associationLookup(
  transaction: Transaction,
): DocumentAssociationLookup {
  return {
    findEquipment(ids) {
      if (ids.length === 0) return Promise.resolve([]);
      return transaction.equipment.findMany({
        where: { id: { in: ids } },
        select: { id: true, active: true },
      });
    },
    findSystemCombinations(ids) {
      if (ids.length === 0) return Promise.resolve([]);
      return transaction.systemCombination.findMany({
        where: { id: { in: ids } },
        select: { id: true, active: true },
      });
    },
  };
}

const documentSnapshotSelect = {
  id: true,
  legacyPacDocumentId: true,
  title: true,
  type: true,
  originalFileName: true,
  storageName: true,
  checksumSha256: true,
  mimeType: true,
  sizeBytes: true,
  version: true,
  documentDate: true,
  isPrimary: true,
  active: true,
  equipment: {
    orderBy: { equipmentId: "asc" },
    select: { equipmentId: true },
  },
  systemCombinations: {
    orderBy: { systemCombinationId: "asc" },
    select: { systemCombinationId: true },
  },
} satisfies Prisma.TechnicalDocumentSelect;

type DocumentSnapshot = Prisma.TechnicalDocumentGetPayload<{
  select: typeof documentSnapshotSelect;
}>;

function snapshot(document: DocumentSnapshot) {
  return {
    id: document.id,
    legacyPacDocumentId: document.legacyPacDocumentId,
    title: document.title,
    type: document.type,
    originalFileName: document.originalFileName,
    storageName: document.storageName,
    checksumSha256: document.checksumSha256,
    mimeType: document.mimeType,
    sizeBytes: document.sizeBytes,
    version: document.version,
    documentDate: document.documentDate?.toISOString() ?? null,
    isPrimary: document.isPrimary,
    active: document.active,
    equipmentIds: document.equipment.map((link) => link.equipmentId),
    systemCombinationIds: document.systemCombinations.map(
      (link) => link.systemCombinationId,
    ),
  };
}

async function createAssociations(
  transaction: Transaction,
  technicalDocumentId: string,
  equipmentIds: string[],
  systemCombinationIds: string[],
) {
  if (equipmentIds.length > 0) {
    await transaction.equipmentTechnicalDocument.createMany({
      data: equipmentIds.map((equipmentId) => ({
        technicalDocumentId,
        equipmentId,
      })),
    });
  }
  if (systemCombinationIds.length > 0) {
    await transaction.systemCombinationTechnicalDocument.createMany({
      data: systemCombinationIds.map((systemCombinationId) => ({
        technicalDocumentId,
        systemCombinationId,
      })),
    });
  }
}

export function findTechnicalDocumentByChecksum(checksumSha256: string) {
  return prisma.technicalDocument.findUnique({
    where: { checksumSha256 },
    select: { id: true },
  });
}

export function findTechnicalDocumentByStorageName(storageName: string) {
  return prisma.technicalDocument.findUnique({
    where: { storageName },
    select: { id: true },
  });
}

export function findTechnicalDocumentsWithoutChecksum() {
  return prisma.technicalDocument.findMany({
    where: { checksumSha256: null },
    select: { id: true, storageName: true },
  });
}

export function createTechnicalDocumentRecord(
  input: TechnicalDocumentInput,
  file: TechnicalDocumentFileMetadata,
  userId: string,
) {
  return prisma.$transaction(async (transaction) => {
    const duplicate = await transaction.technicalDocument.findUnique({
      where: { checksumSha256: file.checksumSha256 },
      select: { id: true },
    });
    if (duplicate) throw new DuplicateTechnicalDocumentError(duplicate.id);

    const associations = await validateDocumentAssociations(
      associationLookup(transaction),
      input,
    );
    const created = await transaction.technicalDocument.create({
      data: {
        ...technicalDocumentMetadata(input),
        ...file,
      },
      select: documentSnapshotSelect,
    });
    await createAssociations(
      transaction,
      created.id,
      associations.equipmentIds,
      associations.systemCombinationIds,
    );
    const after = await transaction.technicalDocument.findUniqueOrThrow({
      where: { id: created.id },
      select: documentSnapshotSelect,
    });
    await transaction.auditLog.create({
      data: {
        userId,
        action: "HVAC_TECHNICAL_DOCUMENT_UPLOAD",
        entityType: "TechnicalDocument",
        entityId: created.id,
        metadata: { after: snapshot(after) },
      },
    });
    return after;
  }, {
    isolationLevel: "Serializable",
  });
}

export function updateTechnicalDocumentRecord(
  id: string,
  input: TechnicalDocumentInput,
  userId: string,
) {
  return prisma.$transaction(async (transaction) => {
    const before = await transaction.technicalDocument.findUnique({
      where: { id },
      select: documentSnapshotSelect,
    });
    if (!before) {
      throw new TechnicalCatalogError(
        "Le document n’existe plus.",
        "NOT_FOUND",
      );
    }
    const currentEquipmentIds = before.equipment.map(
      (link) => link.equipmentId,
    );
    const currentSystemCombinationIds = before.systemCombinations.map(
      (link) => link.systemCombinationId,
    );
    const associations = await validateDocumentAssociations(
      associationLookup(transaction),
      input,
      {
        currentEquipmentIds,
        currentSystemCombinationIds,
      },
    );

    await Promise.all([
      transaction.equipmentTechnicalDocument.deleteMany({
        where: { technicalDocumentId: id },
      }),
      transaction.systemCombinationTechnicalDocument.deleteMany({
        where: { technicalDocumentId: id },
      }),
    ]);
    await transaction.technicalDocument.update({
      where: { id },
      data: technicalDocumentMetadata(input),
    });
    await createAssociations(
      transaction,
      id,
      associations.equipmentIds,
      associations.systemCombinationIds,
    );
    const after = await transaction.technicalDocument.findUniqueOrThrow({
      where: { id },
      select: documentSnapshotSelect,
    });
    await transaction.auditLog.create({
      data: {
        userId,
        action: "HVAC_TECHNICAL_DOCUMENT_UPDATE",
        entityType: "TechnicalDocument",
        entityId: id,
        metadata: {
          before: snapshot(before),
          after: snapshot(after),
        },
      },
    });
    return after;
  }, {
    isolationLevel: "Serializable",
  });
}

export function toggleTechnicalDocumentRecord(
  id: string,
  active: boolean,
  userId: string,
) {
  return prisma.$transaction(async (transaction) => {
    const before = await transaction.technicalDocument.findUnique({
      where: { id },
      select: documentSnapshotSelect,
    });
    if (!before) {
      throw new TechnicalCatalogError(
        "Le document n’existe plus.",
        "NOT_FOUND",
      );
    }
    await transaction.technicalDocument.update({
      where: { id },
      data: technicalDocumentStatusData(active),
    });
    const after = await transaction.technicalDocument.findUniqueOrThrow({
      where: { id },
      select: documentSnapshotSelect,
    });
    await transaction.auditLog.create({
      data: {
        userId,
        action: active
          ? "HVAC_TECHNICAL_DOCUMENT_ENABLE"
          : "HVAC_TECHNICAL_DOCUMENT_DISABLE",
        entityType: "TechnicalDocument",
        entityId: id,
        metadata: {
          before: snapshot(before),
          after: snapshot(after),
        },
      },
    });
    return after;
  });
}
