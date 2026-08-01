import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { Client } from "pg";

const adminUrl = process.env.HVAC_MIGRATION_ADMIN_URL;
const migrationsRoot = path.resolve(process.cwd(), "prisma", "migrations");

function assertIsolatedAdminUrl(raw: string) {
  const parsed = new URL(raw);
  assert.ok(
    ["127.0.0.1", "localhost", "::1"].includes(parsed.hostname),
    "migration tests require a local PostgreSQL host",
  );
  assert.notEqual(parsed.pathname.replace(/^\/+/, ""), "dashboard");
}

async function withTemporaryDatabase(
  label: string,
  run: (client: Client) => Promise<void>,
) {
  assert.ok(adminUrl);
  assertIsolatedAdminUrl(adminUrl);
  const databaseName =
    `dashboard_codex_${label}_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  const databaseUrl = new URL(adminUrl);
  databaseUrl.pathname = `/${databaseName}`;
  const client = new Client({ connectionString: databaseUrl.toString() });
  await client.connect();
  try {
    await run(client);
  } finally {
    await client.end();
    await admin.query(
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1",
      [databaseName],
    );
    await admin.query(`DROP DATABASE "${databaseName}"`);
    await admin.end();
  }
}

async function migrationNames() {
  return (await readdir(migrationsRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

async function applyMigrations(
  client: Client,
  options: { after?: string; through?: string } = {},
) {
  for (const name of await migrationNames()) {
    if (options.after && name <= options.after) continue;
    if (options.through && name > options.through) break;
    const sql = await readFile(
      path.join(migrationsRoot, name, "migration.sql"),
      "utf8",
    );
    await client.query(sql);
  }
}

async function insertReferenceFixture(client: Client) {
  await client.query(`
    INSERT INTO "PacBrand" ("id", "name", "updatedAt") VALUES
      ('brand-a', 'Brand A', CURRENT_TIMESTAMP),
      ('brand-b', 'Brand B', CURRENT_TIMESTAMP);
    INSERT INTO "HeatPump" ("id", "name", "brandId", "updatedAt") VALUES
      ('heat-a', 'Heat A', 'brand-a', CURRENT_TIMESTAMP),
      ('heat-b', 'Heat B', 'brand-b', CURRENT_TIMESTAMP);
    INSERT INTO "Manufacturer" (
      "id", "name", "normalizedName", "updatedAt"
    ) VALUES (
      'manufacturer-a', 'Manufacturer A', 'manufacturer a', CURRENT_TIMESTAMP
    );
    INSERT INTO "Equipment" (
      "id", "manufacturerId", "type", "name",
      "manufacturerReference", "normalizedReference", "updatedAt"
    ) VALUES
      ('ui-a', 'manufacturer-a', 'INDOOR_UNIT', 'UI A', 'UI-A', 'ui-a', CURRENT_TIMESTAMP),
      ('ue-a', 'manufacturer-a', 'OUTDOOR_UNIT', 'UE A', 'UE-A', 'ue-a', CURRENT_TIMESTAMP),
      ('ui-b', 'manufacturer-a', 'INDOOR_UNIT', 'UI B', 'UI-B', 'ui-b', CURRENT_TIMESTAMP),
      ('ue-b', 'manufacturer-a', 'OUTDOOR_UNIT', 'UE B', 'UE-B', 'ue-b', CURRENT_TIMESTAMP),
      ('ui-extra', 'manufacturer-a', 'INDOOR_UNIT', 'UI extra', 'UI-X', 'ui-x', CURRENT_TIMESTAMP),
      ('accessory-a', 'manufacturer-a', 'ACCESSORY', 'Accessory', 'ACC-A', 'acc-a', CURRENT_TIMESTAMP);
    INSERT INTO "LegacyHeatPumpEquipment" (
      "heatPumpId", "equipmentId", "role"
    ) VALUES
      ('heat-a', 'ui-a', 'INDOOR_UNIT'),
      ('heat-a', 'ue-a', 'OUTDOOR_UNIT'),
      ('heat-b', 'ui-b', 'INDOOR_UNIT'),
      ('heat-b', 'ue-b', 'OUTDOOR_UNIT');
  `);
}

test("the full corrected migration chain applies to an empty PostgreSQL database", {
  skip: adminUrl ? false : "HVAC_MIGRATION_ADMIN_URL is not configured",
  timeout: 60_000,
}, async () => {
  await withTemporaryDatabase("empty_chain", async (client) => {
    await applyMigrations(client);
    const result = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM information_schema.columns
       WHERE table_name = 'SystemCombination'
         AND column_name IN ('indoorEquipmentId', 'outdoorEquipmentId')`,
    );
    assert.equal(result.rows[0].count, 2);
  });
});

test("legacy repair persistently archives every noncanonical component before rebuilding", {
  skip: adminUrl ? false : "HVAC_MIGRATION_ADMIN_URL is not configured",
  timeout: 60_000,
}, async () => {
  await withTemporaryDatabase("archive_chain", async (client) => {
    await applyMigrations(client, {
      through: "20260801210000_technical_document_checksum",
    });
    await insertReferenceFixture(client);
    await client.query(`
      INSERT INTO "SystemCombination" (
        "id", "manufacturerId", "name", "normalizedName", "updatedAt"
      ) VALUES
        ('combination-a', 'manufacturer-a', 'Combination A', 'combination a', CURRENT_TIMESTAMP),
        ('combination-b', 'manufacturer-a', 'Combination B', 'combination b', CURRENT_TIMESTAMP);
      INSERT INTO "LegacyHeatPumpSystemCombination" (
        "heatPumpId", "systemCombinationId"
      ) VALUES
        ('heat-a', 'combination-a'),
        ('heat-b', 'combination-b');
      INSERT INTO "CombinationComponent" (
        "id", "systemCombinationId", "equipmentId", "role",
        "quantity", "position", "required", "notes"
      ) VALUES
        ('component-ui-a', 'combination-a', 'ui-a', 'INDOOR_UNIT', 1, 0, true, 'canonical UI'),
        ('component-ue-a', 'combination-a', 'ue-a', 'OUTDOOR_UNIT', 1, 1, true, 'canonical UE'),
        ('component-extra', 'combination-a', 'accessory-a', 'ACCESSORY', 3, 7, false, 'unknown extra'),
        ('component-duplicate-role', 'combination-a', 'ui-extra', 'INDOOR_UNIT', 2, 8, false, 'duplicate role'),
        ('component-incomplete', 'combination-b', 'ui-b', 'INDOOR_UNIT', 1, 0, true, 'only UI');
      INSERT INTO "TechnicalDocument" (
        "id", "title", "originalFileName", "storageName", "mimeType", "sizeBytes", "updatedAt"
      ) VALUES (
        'document-a', 'Document A', 'document-a.pdf',
        '00000000-0000-4000-8000-000000000001.pdf',
        'application/pdf', 10, CURRENT_TIMESTAMP
      );
      INSERT INTO "SystemCombinationTechnicalDocument" (
        "systemCombinationId", "technicalDocumentId"
      ) VALUES ('combination-a', 'document-a');
    `);

    await applyMigrations(client, {
      after: "20260801210000_technical_document_checksum",
      through: "20260801220000_pac_library_remediation",
    });

    const archived = await client.query(`
      SELECT
        "originalComponentId", "systemCombinationId", "equipmentId", "role",
        "quantity", "position", "required", "notes", "reason",
        "sourceCreatedAt", "archivedAt", "provenance", "snapshot"
      FROM "CombinationComponentMigrationArchive"
      ORDER BY "originalComponentId"
    `);
    assert.equal(archived.rowCount, 5);
    const extra = archived.rows.find(
      (row) => row.originalComponentId === "component-extra",
    );
    assert.ok(extra);
    assert.equal(extra.systemCombinationId, "combination-a");
    assert.equal(extra.equipmentId, "accessory-a");
    assert.equal(extra.role, "ACCESSORY");
    assert.equal(extra.quantity, 3);
    assert.equal(extra.position, 7);
    assert.equal(extra.required, false);
    assert.equal(extra.notes, "unknown extra");
    assert.equal(extra.reason, "NON_SPLIT_ROLE");
    assert.equal(extra.snapshot.id, "component-extra");
    assert.equal(
      extra.provenance.sourceMigration,
      "20260801220000_pac_library_remediation",
    );
    assert.ok(extra.sourceCreatedAt);
    assert.ok(extra.archivedAt);

    const rebuilt = await client.query(`
      SELECT "systemCombinationId", "role", "equipmentId"
      FROM "CombinationComponent"
      ORDER BY "systemCombinationId", "role"
    `);
    assert.deepEqual(rebuilt.rows, [
      {
        systemCombinationId: "combination-a",
        role: "INDOOR_UNIT",
        equipmentId: "ui-a",
      },
      {
        systemCombinationId: "combination-a",
        role: "OUTDOOR_UNIT",
        equipmentId: "ue-a",
      },
      {
        systemCombinationId: "combination-b",
        role: "INDOOR_UNIT",
        equipmentId: "ui-b",
      },
      {
        systemCombinationId: "combination-b",
        role: "OUTDOOR_UNIT",
        equipmentId: "ue-b",
      },
    ]);
    assert.equal(
      Number((await client.query(
        `SELECT COUNT(*) FROM "SystemCombinationTechnicalDocument"
         WHERE "technicalDocumentId" = 'document-a'`,
      )).rows[0].count),
      1,
    );
    assert.equal(
      Number((await client.query(
        `SELECT COUNT(*) FROM "LegacyHeatPumpSystemCombination"`,
      )).rows[0].count),
      2,
    );

    await applyMigrations(client, {
      after: "20260801220000_pac_library_remediation",
    });
    const identities = await client.query(`
      SELECT "id", "indoorEquipmentId", "outdoorEquipmentId"
      FROM "SystemCombination"
      ORDER BY "id"
    `);
    assert.deepEqual(identities.rows, [
      {
        id: "combination-a",
        indoorEquipmentId: "ui-a",
        outdoorEquipmentId: "ue-a",
      },
      {
        id: "combination-b",
        indoorEquipmentId: "ui-b",
        outdoorEquipmentId: "ue-b",
      },
    ]);
  });
});

test("duplicate migrated UI and UE pairs stop the corrective migration without partial changes", {
  skip: adminUrl ? false : "HVAC_MIGRATION_ADMIN_URL is not configured",
  timeout: 60_000,
}, async () => {
  await withTemporaryDatabase("duplicate_pair", async (client) => {
    await applyMigrations(client, {
      through: "20260801153000_pac_split_variants",
    });
    await client.query(`
      INSERT INTO "PacBrand" ("id", "name", "updatedAt")
      VALUES ('duplicate-brand', 'Duplicate Brand', CURRENT_TIMESTAMP);
      INSERT INTO "HeatPump" (
        "id", "name", "brandId", "configuration",
        "indoorReference", "outdoorReference", "updatedAt"
      ) VALUES
        (
          'duplicate-heat-a', 'Duplicate Heat A', 'duplicate-brand', 'SPLIT',
          'SAME-UI', 'SAME-UE', CURRENT_TIMESTAMP
        ),
        (
          'duplicate-heat-b', 'Duplicate Heat B', 'duplicate-brand', 'SPLIT',
          'SAME-UI', 'SAME-UE', CURRENT_TIMESTAMP
        );
      INSERT INTO "PacDocument" (
        "id", "heatPumpId", "name", "originalName",
        "storageName", "mimeType", "sizeBytes"
      ) VALUES (
        'duplicate-legacy-document', 'duplicate-heat-b', 'Duplicate manual',
        'duplicate.pdf', 'duplicate-legacy.pdf', 'application/pdf', 10
      );
    `);
    await applyMigrations(client, {
      after: "20260801153000_pac_split_variants",
      through: "20260801220000_pac_library_remediation",
    });

    await assert.rejects(
      applyMigrations(client, {
        after: "20260801220000_pac_library_remediation",
      }),
      /duplicate UI\/UE pairs/,
    );
    await client.query("ROLLBACK");
    const columns = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'SystemCombination'
        AND column_name IN ('indoorEquipmentId', 'outdoorEquipmentId')
    `);
    assert.equal(columns.rowCount, 0, "the failed migration must roll back");
    assert.equal(
      Number((await client.query(
        `SELECT COUNT(*) FROM "CombinationComponent"`,
      )).rows[0].count),
      4,
    );
    assert.equal(
      Number((await client.query(
        `SELECT COUNT(*) FROM "TechnicalDocument"
         WHERE "legacyPacDocumentId" = 'duplicate-legacy-document'`,
      )).rows[0].count),
      1,
    );
    assert.equal(
      Number((await client.query(
        `SELECT COUNT(*) FROM "LegacyHeatPumpSystemCombination"
         WHERE "heatPumpId" IN ('duplicate-heat-a', 'duplicate-heat-b')`,
      )).rows[0].count),
      2,
    );
  });
});
