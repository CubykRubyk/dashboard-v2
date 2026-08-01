import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  ElectricalSupply,
  EquipmentType,
  HeatPumpConfiguration,
  HeatPumpSplitLiaisonType,
  HeatPumpType,
  PacDocumentType,
  PrismaClient,
  TechnicalDocumentType,
  UserRole,
} from "../../src/generated/prisma/client";
import type { CombinationInput } from "../../src/lib/hvac/combination-validation";
import { EquipmentDeletionBlockedError } from "../../src/lib/hvac/deletion-service";

const integrationUrl = process.env.HVAC_INTEGRATION_DATABASE_URL;

test("PAC remediation preserves legacy and document data during controlled deletion", {
  skip: integrationUrl
    ? false
    : "HVAC_INTEGRATION_DATABASE_URL is not configured",
  timeout: 60_000,
}, async () => {
  process.env.DATABASE_URL = integrationUrl!;
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: integrationUrl! }),
  });
  const {
    deleteEquipmentRecord,
    deleteSystemCombinationRecord,
  } = await import("../../src/lib/hvac/deletion-repository");
  const { createCombinationRecordWithDatabase } = await import(
    "../../src/lib/hvac/combination-repository"
  );

  const token = `remediation-${randomUUID()}`;
  const userId = `${token}-admin`;
  const manufacturerId = `${token}-manufacturer`;
  const brandId = `${token}-brand`;
  const heatPumpId = `${token}-heat-pump`;
  const legacyDocumentId = `${token}-legacy-document`;
  const technicalDocumentId = `${token}-technical-document`;
  const indoorId = `${token}-indoor`;
  const outdoorId = `${token}-outdoor`;
  const physicalDirectory = await mkdtemp(
    path.join(os.tmpdir(), "pac-remediation-"),
  );
  const physicalPdf = path.join(physicalDirectory, `${token}.pdf`);
  await writeFile(physicalPdf, "%PDF-1.7\npreserve me");

  const combinationInput = (
    name: string,
  ): CombinationInput => ({
    manufacturerId,
    productRangeId: null,
    indoorEquipmentId: indoorId,
    outdoorEquipmentId: outdoorId,
    name,
    applicationType: HeatPumpType.AIR_WATER,
    splitLiaisonType: HeatPumpSplitLiaisonType.FRIGORIFIC,
    electricalSupply: ElectricalSupply.SINGLE_PHASE,
    nominalPowerKw: 10,
    commissioningNotes: "",
    installationNotes: "",
    internalNotes: "",
    active: true,
  });

  try {
    await prisma.user.create({
      data: {
        id: userId,
        email: `${token}@example.test`,
        name: "Remediation admin",
        passwordHash: "not-used-in-test",
        role: UserRole.ADMIN,
      },
    });
    await prisma.pacBrand.create({
      data: { id: brandId, name: token },
    });
    await prisma.heatPump.create({
      data: {
        id: heatPumpId,
        brandId,
        name: token,
        configuration: HeatPumpConfiguration.SPLIT,
        indoorReference: "UI-TEST",
        outdoorReference: "UE-TEST",
      },
    });
    await prisma.manufacturer.create({
      data: {
        id: manufacturerId,
        name: token,
        normalizedName: token,
      },
    });
    await prisma.equipment.createMany({
      data: [
        {
          id: indoorId,
          manufacturerId,
          type: EquipmentType.INDOOR_UNIT,
          name: "Indoor test",
          manufacturerReference: "UI TEST",
          normalizedReference: "uitest",
        },
        {
          id: outdoorId,
          manufacturerId,
          type: EquipmentType.OUTDOOR_UNIT,
          name: "Outdoor test",
          manufacturerReference: "UE TEST",
          normalizedReference: "uetest",
        },
      ],
    });

    const secondPrisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: integrationUrl! }),
    });
    const concurrent = await Promise.allSettled([
      createCombinationRecordWithDatabase(
        prisma,
        combinationInput(`${token} pair A`),
        userId,
      ),
      createCombinationRecordWithDatabase(
        secondPrisma,
        combinationInput(`${token} pair B`),
        userId,
      ),
    ]);
    await secondPrisma.$disconnect();
    assert.equal(
      concurrent.filter((result) => result.status === "fulfilled").length,
      1,
      "serializable creation must allow only one concurrent UI/UE pair",
    );
    const created = concurrent.find(
      (result): result is PromiseFulfilledResult<
        Awaited<ReturnType<typeof createCombinationRecordWithDatabase>>
      > => result.status === "fulfilled",
    );
    assert.ok(created);
    const combinationId = created.value.id;

    const components = await prisma.combinationComponent.findMany({
      where: { systemCombinationId: combinationId },
    });
    assert.deepEqual(
      components.map((component) => component.role).sort(),
      [EquipmentType.INDOOR_UNIT, EquipmentType.OUTDOOR_UNIT].sort(),
    );

    await assert.rejects(
      prisma.$transaction((transaction) => (
        transaction.systemCombination.create({
          data: {
            id: `${token}-empty-combination`,
            manufacturerId,
            name: `${token} empty`,
            normalizedName: `${token} empty`,
          },
        })
      )),
    );
    await assert.rejects(
      prisma.$transaction(async (transaction) => {
        const invalidId = `${token}-two-indoor`;
        await transaction.systemCombination.create({
          data: {
            id: invalidId,
            manufacturerId,
            name: `${token} two indoor`,
            normalizedName: `${token} two indoor`,
          },
        });
        await transaction.combinationComponent.createMany({
          data: [
            {
              systemCombinationId: invalidId,
              equipmentId: indoorId,
              role: EquipmentType.INDOOR_UNIT,
            },
            {
              systemCombinationId: invalidId,
              equipmentId: outdoorId,
              role: EquipmentType.INDOOR_UNIT,
            },
          ],
        });
      }),
    );
    await assert.rejects(
      prisma.$transaction(async (transaction) => {
        const invalidId = `${token}-two-outdoor`;
        await transaction.systemCombination.create({
          data: {
            id: invalidId,
            manufacturerId,
            name: `${token} two outdoor`,
            normalizedName: `${token} two outdoor`,
          },
        });
        await transaction.combinationComponent.createMany({
          data: [
            {
              systemCombinationId: invalidId,
              equipmentId: indoorId,
              role: EquipmentType.OUTDOOR_UNIT,
            },
            {
              systemCombinationId: invalidId,
              equipmentId: outdoorId,
              role: EquipmentType.OUTDOOR_UNIT,
            },
          ],
        });
      }),
    );

    await prisma.pacDocument.create({
      data: {
        id: legacyDocumentId,
        heatPumpId,
        name: "Legacy manual",
        type: PacDocumentType.INSTALLATION_MANUAL,
        originalName: "legacy.pdf",
        storageName: `${token}-legacy.pdf`,
        mimeType: "application/pdf",
        sizeBytes: 20,
      },
    });
    await prisma.technicalDocument.create({
      data: {
        id: technicalDocumentId,
        legacyPacDocumentId: legacyDocumentId,
        title: "Technical manual",
        type: TechnicalDocumentType.INSTALLATION_MANUAL,
        originalFileName: "technical.pdf",
        storageName: `${token}-technical.pdf`,
        mimeType: "application/pdf",
        sizeBytes: 20,
      },
    });
    await prisma.equipmentTechnicalDocument.create({
      data: {
        technicalDocumentId,
        equipmentId: indoorId,
      },
    });
    await prisma.systemCombinationTechnicalDocument.create({
      data: {
        technicalDocumentId,
        systemCombinationId: combinationId,
      },
    });

    await prisma.pacDocument.delete({ where: { id: legacyDocumentId } });
    const documentAfterLegacyDelete =
      await prisma.technicalDocument.findUniqueOrThrow({
        where: { id: technicalDocumentId },
        include: {
          equipment: true,
          systemCombinations: true,
        },
      });
    assert.equal(documentAfterLegacyDelete.legacyPacDocumentId, null);
    assert.equal(documentAfterLegacyDelete.equipment.length, 1);
    assert.equal(documentAfterLegacyDelete.systemCombinations.length, 1);

    await assert.rejects(
      deleteEquipmentRecord(outdoorId, "UE TEST", userId),
      (error) => (
        error instanceof EquipmentDeletionBlockedError
        && error.blockers.length === 1
        && error.blockers[0].id === combinationId
      ),
    );

    const combinationName = created.value.name;
    const deletedCombination = await deleteSystemCombinationRecord(
      combinationId,
      combinationName,
      userId,
    );
    assert.equal(deletedCombination.deleted, true);
    assert.equal(
      (await deleteSystemCombinationRecord(
        combinationId,
        combinationName,
        userId,
      )).deleted,
      false,
      "double submit must be idempotent",
    );
    assert.equal(
      await prisma.combinationComponent.count({
        where: { systemCombinationId: combinationId },
      }),
      0,
    );
    assert.equal(
      await prisma.equipment.count({
        where: { id: { in: [indoorId, outdoorId] } },
      }),
      2,
    );
    assert.ok(
      await prisma.technicalDocument.findUnique({
        where: { id: technicalDocumentId },
      }),
    );
    assert.equal(
      await readFile(physicalPdf, "utf8"),
      "%PDF-1.7\npreserve me",
    );
    const combinationAudit = await prisma.auditLog.findFirst({
      where: {
        action: "HVAC_SYSTEM_COMBINATION_DELETE",
        entityId: combinationId,
      },
    });
    assert.equal(combinationAudit?.userId, userId);
    assert.ok(combinationAudit?.metadata);

    await prisma.legacyHeatPumpEquipment.create({
      data: {
        heatPumpId,
        equipmentId: indoorId,
        role: EquipmentType.INDOOR_UNIT,
      },
    });
    const deletedEquipment = await deleteEquipmentRecord(
      indoorId,
      "UI TEST",
      userId,
    );
    assert.equal(deletedEquipment.deleted, true);
    assert.equal(
      await prisma.heatPump.count({ where: { id: heatPumpId } }),
      1,
    );
    assert.equal(
      await prisma.equipmentTechnicalDocument.count({
        where: { equipmentId: indoorId },
      }),
      0,
    );
    assert.ok(
      await prisma.technicalDocument.findUnique({
        where: { id: technicalDocumentId },
      }),
    );
    const equipmentAudit = await prisma.auditLog.findFirst({
      where: {
        action: "HVAC_EQUIPMENT_DELETE",
        entityId: indoorId,
      },
    });
    assert.equal(equipmentAudit?.userId, userId);
    assert.ok(equipmentAudit?.metadata);

    const monoblocId = `${token}-monobloc`;
    await prisma.equipment.create({
      data: {
        id: monoblocId,
        manufacturerId,
        type: EquipmentType.MONOBLOC,
        name: "Monobloc test",
        manufacturerReference: "MONO TEST",
        normalizedReference: "monotest",
      },
    });
    assert.equal(
      (await deleteEquipmentRecord(
        monoblocId,
        "MONO TEST",
        userId,
      )).deleted,
      true,
    );
    assert.equal(
      (await deleteEquipmentRecord(
        monoblocId,
        "MONO TEST",
        userId,
      )).deleted,
      false,
      "equipment double submit must be idempotent",
    );
  } finally {
    await prisma.systemCombinationTechnicalDocument.deleteMany({
      where: {
        systemCombination: { manufacturerId },
      },
    }).catch(() => undefined);
    await prisma.combinationComponent.deleteMany({
      where: { systemCombination: { manufacturerId } },
    }).catch(() => undefined);
    await prisma.legacyHeatPumpSystemCombination.deleteMany({
      where: { systemCombination: { manufacturerId } },
    }).catch(() => undefined);
    await prisma.systemCombination.deleteMany({
      where: { manufacturerId },
    }).catch(() => undefined);
    await prisma.equipmentTechnicalDocument.deleteMany({
      where: { technicalDocumentId },
    }).catch(() => undefined);
    await prisma.legacyHeatPumpEquipment.deleteMany({
      where: { heatPumpId },
    }).catch(() => undefined);
    await prisma.equipment.deleteMany({
      where: { manufacturerId },
    }).catch(() => undefined);
    await prisma.technicalDocument.deleteMany({
      where: { id: technicalDocumentId },
    }).catch(() => undefined);
    await prisma.pacDocument.deleteMany({
      where: { heatPumpId },
    }).catch(() => undefined);
    await prisma.heatPump.deleteMany({
      where: { id: heatPumpId },
    }).catch(() => undefined);
    await prisma.pacBrand.deleteMany({
      where: { id: brandId },
    }).catch(() => undefined);
    await prisma.manufacturer.deleteMany({
      where: { id: manufacturerId },
    }).catch(() => undefined);
    await prisma.auditLog.deleteMany({
      where: { userId },
    }).catch(() => undefined);
    await prisma.user.deleteMany({
      where: { id: userId },
    }).catch(() => undefined);
    await prisma.$disconnect();
    await rm(physicalDirectory, { recursive: true, force: true });
  }
});
