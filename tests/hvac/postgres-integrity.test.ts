import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { Client } from "pg";
import {
  EquipmentType,
  PrismaClient,
  UserRole,
} from "../../src/generated/prisma/client";
import { authorizeCurrentTechnicalCatalogAdmin } from "../../src/lib/auth/privileged-auth";
import type { CombinationInput } from "../../src/lib/hvac/combination-validation";
import { TechnicalCatalogError } from "../../src/lib/hvac/errors";
import { recordLegacyMutationRejection } from "../../src/lib/hvac/legacy-audit-service";

const integrationUrl = process.env.HVAC_INTEGRATION_DATABASE_URL;

function assertIsolatedDatabaseUrl(raw: string) {
  const parsed = new URL(raw);
  assert.ok(["127.0.0.1", "localhost", "::1"].includes(parsed.hostname));
  assert.match(parsed.pathname, /^\/dashboard_codex_/);
  assert.notEqual(parsed.pathname, "/dashboard");
}

function input(
  manufacturerId: string,
  indoorEquipmentId: string,
  outdoorEquipmentId: string,
  name: string,
): CombinationInput {
  return {
    manufacturerId,
    productRangeId: null,
    indoorEquipmentId,
    outdoorEquipmentId,
    name,
    applicationType: null,
    splitLiaisonType: null,
    electricalSupply: null,
    nominalPowerKw: null,
    commissioningNotes: "",
    installationNotes: "",
    internalNotes: "",
    active: true,
  };
}

test("PostgreSQL enforces canonical split pairs and Equipment invariants", {
  skip: integrationUrl
    ? false
    : "HVAC_INTEGRATION_DATABASE_URL is not configured",
  timeout: 90_000,
}, async () => {
  assertIsolatedDatabaseUrl(integrationUrl!);
  process.env.DATABASE_URL = integrationUrl!;
  const {
    createCombinationRecordWithDatabase,
  } = await import("../../src/lib/hvac/combination-repository");
  const {
    updateEquipmentRecord,
  } = await import("../../src/lib/hvac/catalog-repository");
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: integrationUrl! }),
  });
  const token = `integrity-${randomUUID()}`;
  const userId = `${token}-admin`;
  const manufacturerA = `${token}-manufacturer-a`;
  const manufacturerB = `${token}-manufacturer-b`;
  const ids = {
    uiA: `${token}-ui-a`,
    ueA: `${token}-ue-a`,
    uiB: `${token}-ui-b`,
    ueB: `${token}-ue-b`,
    uiC: `${token}-ui-c`,
    ueC: `${token}-ue-c`,
  };

  try {
    await prisma.user.create({
      data: {
        id: userId,
        email: `${token}@example.test`,
        name: "Integrity admin",
        passwordHash: "not-used",
        role: UserRole.ADMIN,
      },
    });
    await prisma.manufacturer.createMany({
      data: [
        {
          id: manufacturerA,
          name: `${token} Manufacturer A`,
          normalizedName: `${token} manufacturer a`,
        },
        {
          id: manufacturerB,
          name: `${token} Manufacturer B`,
          normalizedName: `${token} manufacturer b`,
        },
      ],
    });
    await prisma.equipment.createMany({
      data: [
        [ids.uiA, EquipmentType.INDOOR_UNIT, "UI-A"],
        [ids.ueA, EquipmentType.OUTDOOR_UNIT, "UE-A"],
        [ids.uiB, EquipmentType.INDOOR_UNIT, "UI-B"],
        [ids.ueB, EquipmentType.OUTDOOR_UNIT, "UE-B"],
        [ids.uiC, EquipmentType.INDOOR_UNIT, "UI-C"],
        [ids.ueC, EquipmentType.OUTDOOR_UNIT, "UE-C"],
      ].map(([id, type, reference]) => ({
        id,
        manufacturerId: manufacturerA,
        type: type as EquipmentType,
        name: String(reference),
        manufacturerReference: `${String(reference)}-${token}`,
        normalizedReference: `${String(reference).toLowerCase()}-${token}`,
      })),
    });

    const combinationA = await createCombinationRecordWithDatabase(
      prisma,
      input(manufacturerA, ids.uiA, ids.ueA, `${token} combination A`),
      userId,
    );
    const combinationB = await createCombinationRecordWithDatabase(
      prisma,
      input(manufacturerA, ids.uiB, ids.ueB, `${token} combination B`),
      userId,
    );
    assert.ok(combinationA.id);
    assert.ok(combinationB.id);

    await assert.rejects(
      prisma.equipment.update({
        where: { id: ids.uiA },
        data: { type: EquipmentType.OTHER },
      }),
    );
    await assert.rejects(
      prisma.equipment.update({
        where: { id: ids.ueA },
        data: { manufacturerId: manufacturerB },
      }),
    );
    await assert.rejects(
      updateEquipmentRecord(
        ids.uiA,
        { type: EquipmentType.OTHER },
        userId,
      ),
      (error) => (
        error instanceof TechnicalCatalogError
        && error.code === "DEPENDENCY_CONFLICT"
        && error.message.includes(combinationA.id)
      ),
    );
    assert.equal(
      (await prisma.equipment.findUniqueOrThrow({
        where: { id: ids.uiA },
      })).type,
      EquipmentType.INDOOR_UNIT,
    );
    await prisma.equipment.update({
      where: { id: ids.uiA },
      data: { active: false },
    });
    await prisma.equipment.update({
      where: { id: ids.uiA },
      data: { active: true },
    });

    await assert.rejects(
      prisma.combinationComponent.delete({
        where: {
          systemCombinationId_role: {
            systemCombinationId: combinationA.id,
            role: EquipmentType.INDOOR_UNIT,
          },
        },
      }),
    );
    await assert.rejects(
      prisma.$transaction(async (transaction) => {
        await transaction.combinationComponent.delete({
          where: {
            systemCombinationId_role: {
              systemCombinationId: combinationA.id,
              role: EquipmentType.OUTDOOR_UNIT,
            },
          },
        });
        await transaction.combinationComponent.update({
          where: {
            systemCombinationId_role: {
              systemCombinationId: combinationA.id,
              role: EquipmentType.INDOOR_UNIT,
            },
          },
          data: { role: EquipmentType.OUTDOOR_UNIT },
        });
      }),
    );
    await assert.rejects(
      prisma.combinationComponent.update({
        where: {
          systemCombinationId_role: {
            systemCombinationId: combinationA.id,
            role: EquipmentType.INDOOR_UNIT,
          },
        },
        data: { equipmentId: ids.ueC },
      }),
    );

    // OLD combination valid, NEW combination invalid after moving a component.
    await assert.rejects(
      prisma.$transaction(async (transaction) => {
        const bIndoor = await transaction.combinationComponent.findUniqueOrThrow({
          where: {
            systemCombinationId_role: {
              systemCombinationId: combinationB.id,
              role: EquipmentType.INDOOR_UNIT,
            },
          },
        });
        await transaction.combinationComponent.delete({
          where: { id: bIndoor.id },
        });
        await transaction.systemCombination.update({
          where: { id: combinationA.id },
          data: { indoorEquipmentId: ids.uiC },
        });
        await transaction.combinationComponent.update({
          where: {
            systemCombinationId_role: {
              systemCombinationId: combinationA.id,
              role: EquipmentType.INDOOR_UNIT,
            },
          },
          data: { systemCombinationId: combinationB.id },
        });
        await transaction.combinationComponent.create({
          data: {
            systemCombinationId: combinationA.id,
            equipmentId: ids.uiC,
            role: EquipmentType.INDOOR_UNIT,
            position: 0,
          },
        });
      }),
    );

    // Keep NEW valid but leave OLD incomplete: validation must still inspect OLD.
    await assert.rejects(
      prisma.$transaction(async (transaction) => {
        const bOutdoor = await transaction.combinationComponent.findUniqueOrThrow({
          where: {
            systemCombinationId_role: {
              systemCombinationId: combinationB.id,
              role: EquipmentType.OUTDOOR_UNIT,
            },
          },
        });
        await transaction.combinationComponent.delete({
          where: { id: bOutdoor.id },
        });
        await transaction.systemCombination.update({
          where: { id: combinationB.id },
          data: { outdoorEquipmentId: ids.ueA },
        });
        await transaction.combinationComponent.update({
          where: {
            systemCombinationId_role: {
              systemCombinationId: combinationA.id,
              role: EquipmentType.OUTDOOR_UNIT,
            },
          },
          data: { systemCombinationId: combinationB.id },
        });
      }),
    );

    const auditCountBeforeConflict = await prisma.auditLog.count({
      where: { action: "HVAC_SYSTEM_COMBINATION_CREATE", userId },
    });
    await assert.rejects(
      createCombinationRecordWithDatabase(
        prisma,
        input(manufacturerA, ids.uiA, ids.ueA, `${token} duplicate service`),
        userId,
      ),
    );
    assert.equal(
      await prisma.auditLog.count({
        where: { action: "HVAC_SYSTEM_COMBINATION_CREATE", userId },
      }),
      auditCountBeforeConflict,
      "a rolled-back duplicate must not create a success audit",
    );

    const clientA = new Client({ connectionString: integrationUrl! });
    const clientB = new Client({ connectionString: integrationUrl! });
    await Promise.all([clientA.connect(), clientB.connect()]);
    try {
      await clientA.query("BEGIN");
      await clientB.query("BEGIN");
      const directA = `${token}-direct-a`;
      const directB = `${token}-direct-b`;
      await clientA.query(
        `INSERT INTO "SystemCombination" (
          "id", "manufacturerId", "name", "normalizedName",
          "indoorEquipmentId", "outdoorEquipmentId", "updatedAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
        [
          directA,
          manufacturerA,
          `${token} direct A`,
          `${token} direct a`,
          ids.uiC,
          ids.ueC,
        ],
      );
      await clientA.query(
        `INSERT INTO "CombinationComponent" (
          "id", "systemCombinationId", "equipmentId", "role", "position"
        ) VALUES
          ($1 || '-ui', $1, $2, 'INDOOR_UNIT', 0),
          ($1 || '-ue', $1, $3, 'OUTDOOR_UNIT', 1)`,
        [directA, ids.uiC, ids.ueC],
      );
      const blockedInsert = clientB.query(
        `INSERT INTO "SystemCombination" (
          "id", "manufacturerId", "name", "normalizedName",
          "indoorEquipmentId", "outdoorEquipmentId", "updatedAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
        [
          directB,
          manufacturerA,
          `${token} direct B`,
          `${token} direct b`,
          ids.uiC,
          ids.ueC,
        ],
      );
      await new Promise((resolve) => setTimeout(resolve, 50));
      await clientA.query("COMMIT");
      await assert.rejects(blockedInsert, /duplicate key/);
      await clientB.query("ROLLBACK");

      await clientB.query("BEGIN");
      await assert.rejects(
        clientB.query(
          `INSERT INTO "SystemCombination" (
            "id", "manufacturerId", "name", "normalizedName",
            "indoorEquipmentId", "outdoorEquipmentId", "updatedAt"
          ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
          [
            `${token}-same-tx`,
            manufacturerA,
            `${token} same transaction`,
            `${token} same transaction`,
            ids.uiC,
            ids.ueC,
          ],
        ),
        /duplicate key/,
      );
      await clientB.query("ROLLBACK");

      await clientB.query("BEGIN");
      const inverseId = `${token}-inverse`;
      await clientB.query(
        `INSERT INTO "SystemCombination" (
          "id", "manufacturerId", "name", "normalizedName",
          "indoorEquipmentId", "outdoorEquipmentId", "updatedAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
        [
          inverseId,
          manufacturerA,
          `${token} inverse`,
          `${token} inverse`,
          ids.ueA,
          ids.uiA,
        ],
      );
      await clientB.query(
        `INSERT INTO "CombinationComponent" (
          "id", "systemCombinationId", "equipmentId", "role", "position"
        ) VALUES
          ($1 || '-ui', $1, $2, 'INDOOR_UNIT', 0),
          ($1 || '-ue', $1, $3, 'OUTDOOR_UNIT', 1)`,
        [inverseId, ids.ueA, ids.uiA],
      );
      await assert.rejects(clientB.query("COMMIT"));
      await clientB.query("ROLLBACK").catch(() => undefined);
    } finally {
      await Promise.all([clientA.end(), clientB.end()]);
    }

    const refrigerantId = `${token}-refrigerant`;
    await prisma.refrigerant.create({
      data: { id: refrigerantId, name: `${token} R32`, gwp: 675 },
    });
    await prisma.equipment.update({
      where: { id: ids.uiC },
      data: { refrigerantId },
    });
    await assert.rejects(
      prisma.refrigerant.delete({ where: { id: refrigerantId } }),
    );
    assert.equal(
      (await prisma.equipment.findUniqueOrThrow({
        where: { id: ids.uiC },
      })).refrigerantId,
      refrigerantId,
    );

    await recordLegacyMutationRejection({
      findCurrentUser(id) {
        return prisma.user.findUnique({
          where: { id },
          select: { id: true, role: true, active: true },
        });
      },
      async createAudit(data) {
        await prisma.auditLog.create({ data });
      },
    }, {
      operation: "DELETE",
      entityType: "Refrigerant",
      entityId: refrigerantId,
    }, userId);
    const rejectedAudit = await prisma.auditLog.findFirstOrThrow({
      where: {
        action: "HVAC_LEGACY_MUTATION_REJECTED",
        entityType: "Refrigerant",
        entityId: refrigerantId,
      },
      orderBy: { createdAt: "desc" },
    });
    assert.equal(rejectedAudit.userId, userId);
    assert.equal(
      (rejectedAudit.metadata as { reason: string }).reason,
      "LEGACY_CATALOG_READ_ONLY",
    );
  } finally {
    await prisma.$disconnect();
  }
});

test("privileged authorization always uses the current database user", {
  skip: integrationUrl
    ? false
    : "HVAC_INTEGRATION_DATABASE_URL is not configured",
  timeout: 30_000,
}, async () => {
  assertIsolatedDatabaseUrl(integrationUrl!);
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: integrationUrl! }),
  });
  const id = `auth-${randomUUID()}`;
  const session = { id, role: UserRole.ADMIN };
  const lookup = {
    findCurrentUser(userId: string) {
      return prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          active: true,
        },
      });
    },
  };
  try {
    await prisma.user.create({
      data: {
        id,
        email: `${id}@example.test`,
        name: "Current admin",
        passwordHash: "not-used",
        role: UserRole.ADMIN,
      },
    });
    assert.equal(
      (await authorizeCurrentTechnicalCatalogAdmin(session, lookup)).role,
      UserRole.ADMIN,
    );
    assert.equal(
      (
        await authorizeCurrentTechnicalCatalogAdmin(
          { id, role: UserRole.VIEWER },
          lookup,
        )
      ).role,
      UserRole.ADMIN,
      "the current DB role, not a stale token role, is authoritative",
    );

    await prisma.user.update({ where: { id }, data: { active: false } });
    await assert.rejects(
      authorizeCurrentTechnicalCatalogAdmin(session, lookup),
      (error) => (
        error instanceof TechnicalCatalogError
        && error.code === "UNAUTHORIZED"
      ),
    );
    await prisma.user.update({
      where: { id },
      data: { active: true, role: UserRole.OPERATOR },
    });
    await assert.rejects(
      authorizeCurrentTechnicalCatalogAdmin(session, lookup),
      TechnicalCatalogError,
    );
    await prisma.user.update({
      where: { id },
      data: { role: UserRole.VIEWER },
    });
    await assert.rejects(
      authorizeCurrentTechnicalCatalogAdmin(session, lookup),
      TechnicalCatalogError,
    );
    await prisma.user.delete({ where: { id } });
    await assert.rejects(
      authorizeCurrentTechnicalCatalogAdmin(session, lookup),
      TechnicalCatalogError,
    );
    await assert.rejects(
      authorizeCurrentTechnicalCatalogAdmin(null, lookup),
      TechnicalCatalogError,
    );
    await assert.rejects(
      authorizeCurrentTechnicalCatalogAdmin(
        { id: `${id}-missing`, role: UserRole.ADMIN },
        lookup,
      ),
      TechnicalCatalogError,
    );
  } finally {
    await prisma.user.deleteMany({ where: { id } }).catch(() => undefined);
    await prisma.$disconnect();
  }
});
