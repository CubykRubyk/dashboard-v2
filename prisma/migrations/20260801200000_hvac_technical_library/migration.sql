BEGIN;

CREATE TYPE "EquipmentType" AS ENUM (
  'INDOOR_UNIT',
  'OUTDOOR_UNIT',
  'MONOBLOC',
  'ACCESSORY',
  'CONTROLLER',
  'OTHER'
);

CREATE TYPE "TechnicalDocumentType" AS ENUM (
  'INSTALLATION_MANUAL',
  'USER_MANUAL',
  'DATASHEET',
  'WIRING_DIAGRAM',
  'ERROR_CODES',
  'CERTIFICATE',
  'OTHER'
);

CREATE TABLE "Manufacturer" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Manufacturer_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Manufacturer_normalizedName_check"
    CHECK ("normalizedName" = lower(regexp_replace(btrim("name"), '\s+', ' ', 'g')))
);

CREATE TABLE "ProductRange" (
  "id" TEXT NOT NULL,
  "manufacturerId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "legacyPacRangeId" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductRange_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductRange_normalizedName_check"
    CHECK ("normalizedName" = lower(regexp_replace(btrim("name"), '\s+', ' ', 'g')))
);

CREATE TABLE "Equipment" (
  "id" TEXT NOT NULL,
  "manufacturerId" TEXT NOT NULL,
  "productRangeId" TEXT,
  "type" "EquipmentType" NOT NULL,
  "name" TEXT NOT NULL,
  "manufacturerReference" TEXT NOT NULL,
  "normalizedReference" TEXT NOT NULL,
  "referenceNeedsReview" BOOLEAN NOT NULL DEFAULT false,
  "electricalSupply" "ElectricalSupply",
  "recommendedProtection" TEXT NOT NULL DEFAULT '',
  "powerCable" TEXT NOT NULL DEFAULT '',
  "communicationCable" TEXT NOT NULL DEFAULT '',
  "refrigerantId" TEXT,
  "factoryChargeKg" DOUBLE PRECISION,
  "maxPipeLengthM" DOUBLE PRECISION,
  "maxHeightDifferenceM" DOUBLE PRECISION,
  "includedPipeLengthM" DOUBLE PRECISION,
  "additionalChargeGPerM" DOUBLE PRECISION,
  "liquidPipeDiameter" TEXT NOT NULL DEFAULT '',
  "gasPipeDiameter" TEXT NOT NULL DEFAULT '',
  "hydraulicConnections" TEXT NOT NULL DEFAULT '',
  "minimumFlow" TEXT NOT NULL DEFAULT '',
  "minimumWaterVolume" TEXT NOT NULL DEFAULT '',
  "maximumFlowTemperature" TEXT NOT NULL DEFAULT '',
  "bufferTankRecommendation" TEXT NOT NULL DEFAULT '',
  "nominalPowerKw" DOUBLE PRECISION,
  "commissioningNotes" TEXT NOT NULL DEFAULT '',
  "installationNotes" TEXT NOT NULL DEFAULT '',
  "internalNotes" TEXT NOT NULL DEFAULT '',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Equipment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Equipment_normalizedReference_check"
    CHECK (
      "normalizedReference" <> ''
      AND "normalizedReference" = lower(regexp_replace(btrim("manufacturerReference"), '\s+', '', 'g'))
    )
);

CREATE TABLE "SystemCombination" (
  "id" TEXT NOT NULL,
  "manufacturerId" TEXT NOT NULL,
  "productRangeId" TEXT,
  "name" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "applicationType" "HeatPumpType",
  "splitLiaisonType" "HeatPumpSplitLiaisonType",
  "electricalSupply" "ElectricalSupply",
  "nominalPowerKw" DOUBLE PRECISION,
  "commissioningNotes" TEXT NOT NULL DEFAULT '',
  "installationNotes" TEXT NOT NULL DEFAULT '',
  "internalNotes" TEXT NOT NULL DEFAULT '',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SystemCombination_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SystemCombination_normalizedName_check"
    CHECK ("normalizedName" = lower(regexp_replace(btrim("name"), '\s+', ' ', 'g')))
);

CREATE TABLE "CombinationComponent" (
  "id" TEXT NOT NULL,
  "systemCombinationId" TEXT NOT NULL,
  "equipmentId" TEXT NOT NULL,
  "role" "EquipmentType" NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "position" INTEGER NOT NULL DEFAULT 0,
  "required" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CombinationComponent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TechnicalDocument" (
  "id" TEXT NOT NULL,
  "legacyPacDocumentId" TEXT,
  "title" TEXT NOT NULL,
  "type" "TechnicalDocumentType" NOT NULL DEFAULT 'OTHER',
  "originalFileName" TEXT NOT NULL,
  "storageName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "version" TEXT NOT NULL DEFAULT '',
  "documentDate" TIMESTAMP(3),
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TechnicalDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EquipmentTechnicalDocument" (
  "equipmentId" TEXT NOT NULL,
  "technicalDocumentId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EquipmentTechnicalDocument_pkey"
    PRIMARY KEY ("equipmentId", "technicalDocumentId")
);

CREATE TABLE "SystemCombinationTechnicalDocument" (
  "systemCombinationId" TEXT NOT NULL,
  "technicalDocumentId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SystemCombinationTechnicalDocument_pkey"
    PRIMARY KEY ("systemCombinationId", "technicalDocumentId")
);

CREATE TABLE "LegacyHeatPumpEquipment" (
  "heatPumpId" TEXT NOT NULL,
  "equipmentId" TEXT NOT NULL,
  "role" "EquipmentType" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LegacyHeatPumpEquipment_pkey"
    PRIMARY KEY ("heatPumpId", "equipmentId", "role")
);

CREATE TABLE "LegacyHeatPumpSystemCombination" (
  "heatPumpId" TEXT NOT NULL,
  "systemCombinationId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LegacyHeatPumpSystemCombination_pkey" PRIMARY KEY ("heatPumpId")
);

CREATE UNIQUE INDEX "Manufacturer_normalizedName_key"
ON "Manufacturer"("normalizedName");

CREATE INDEX "Manufacturer_active_name_idx"
ON "Manufacturer"("active", "name");

CREATE UNIQUE INDEX "ProductRange_legacyPacRangeId_key"
ON "ProductRange"("legacyPacRangeId");

CREATE UNIQUE INDEX "ProductRange_manufacturerId_normalizedName_key"
ON "ProductRange"("manufacturerId", "normalizedName");

CREATE INDEX "ProductRange_manufacturerId_active_idx"
ON "ProductRange"("manufacturerId", "active");

CREATE UNIQUE INDEX "Equipment_manufacturerId_normalizedReference_key"
ON "Equipment"("manufacturerId", "normalizedReference");

CREATE INDEX "Equipment_manufacturerId_type_active_idx"
ON "Equipment"("manufacturerId", "type", "active");

CREATE INDEX "Equipment_productRangeId_idx"
ON "Equipment"("productRangeId");

CREATE INDEX "Equipment_refrigerantId_idx"
ON "Equipment"("refrigerantId");

CREATE UNIQUE INDEX "SystemCombination_manufacturerId_normalizedName_key"
ON "SystemCombination"("manufacturerId", "normalizedName");

CREATE INDEX "SystemCombination_manufacturerId_active_idx"
ON "SystemCombination"("manufacturerId", "active");

CREATE INDEX "SystemCombination_productRangeId_idx"
ON "SystemCombination"("productRangeId");

CREATE UNIQUE INDEX "CombinationComponent_systemCombinationId_equipmentId_key"
ON "CombinationComponent"("systemCombinationId", "equipmentId");

CREATE INDEX "CombinationComponent_equipmentId_idx"
ON "CombinationComponent"("equipmentId");

CREATE UNIQUE INDEX "TechnicalDocument_legacyPacDocumentId_key"
ON "TechnicalDocument"("legacyPacDocumentId");

CREATE UNIQUE INDEX "TechnicalDocument_storageName_key"
ON "TechnicalDocument"("storageName");

CREATE INDEX "TechnicalDocument_type_active_idx"
ON "TechnicalDocument"("type", "active");

CREATE INDEX "EquipmentTechnicalDocument_technicalDocumentId_idx"
ON "EquipmentTechnicalDocument"("technicalDocumentId");

CREATE INDEX "SystemCombinationTechnicalDocument_technicalDocumentId_idx"
ON "SystemCombinationTechnicalDocument"("technicalDocumentId");

CREATE INDEX "LegacyHeatPumpEquipment_equipmentId_idx"
ON "LegacyHeatPumpEquipment"("equipmentId");

CREATE INDEX "LegacyHeatPumpSystemCombination_systemCombinationId_idx"
ON "LegacyHeatPumpSystemCombination"("systemCombinationId");

ALTER TABLE "ProductRange"
ADD CONSTRAINT "ProductRange_manufacturerId_fkey"
FOREIGN KEY ("manufacturerId") REFERENCES "Manufacturer"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Equipment"
ADD CONSTRAINT "Equipment_manufacturerId_fkey"
FOREIGN KEY ("manufacturerId") REFERENCES "Manufacturer"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Equipment"
ADD CONSTRAINT "Equipment_productRangeId_fkey"
FOREIGN KEY ("productRangeId") REFERENCES "ProductRange"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Equipment"
ADD CONSTRAINT "Equipment_refrigerantId_fkey"
FOREIGN KEY ("refrigerantId") REFERENCES "Refrigerant"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SystemCombination"
ADD CONSTRAINT "SystemCombination_manufacturerId_fkey"
FOREIGN KEY ("manufacturerId") REFERENCES "Manufacturer"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SystemCombination"
ADD CONSTRAINT "SystemCombination_productRangeId_fkey"
FOREIGN KEY ("productRangeId") REFERENCES "ProductRange"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CombinationComponent"
ADD CONSTRAINT "CombinationComponent_systemCombinationId_fkey"
FOREIGN KEY ("systemCombinationId") REFERENCES "SystemCombination"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CombinationComponent"
ADD CONSTRAINT "CombinationComponent_equipmentId_fkey"
FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TechnicalDocument"
ADD CONSTRAINT "TechnicalDocument_legacyPacDocumentId_fkey"
FOREIGN KEY ("legacyPacDocumentId") REFERENCES "PacDocument"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EquipmentTechnicalDocument"
ADD CONSTRAINT "EquipmentTechnicalDocument_equipmentId_fkey"
FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EquipmentTechnicalDocument"
ADD CONSTRAINT "EquipmentTechnicalDocument_technicalDocumentId_fkey"
FOREIGN KEY ("technicalDocumentId") REFERENCES "TechnicalDocument"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SystemCombinationTechnicalDocument"
ADD CONSTRAINT "SystemCombinationTechnicalDocument_systemCombinationId_fkey"
FOREIGN KEY ("systemCombinationId") REFERENCES "SystemCombination"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SystemCombinationTechnicalDocument"
ADD CONSTRAINT "SystemCombinationTechnicalDocument_technicalDocumentId_fkey"
FOREIGN KEY ("technicalDocumentId") REFERENCES "TechnicalDocument"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LegacyHeatPumpEquipment"
ADD CONSTRAINT "LegacyHeatPumpEquipment_heatPumpId_fkey"
FOREIGN KEY ("heatPumpId") REFERENCES "HeatPump"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LegacyHeatPumpEquipment"
ADD CONSTRAINT "LegacyHeatPumpEquipment_equipmentId_fkey"
FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LegacyHeatPumpSystemCombination"
ADD CONSTRAINT "LegacyHeatPumpSystemCombination_heatPumpId_fkey"
FOREIGN KEY ("heatPumpId") REFERENCES "HeatPump"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LegacyHeatPumpSystemCombination"
ADD CONSTRAINT "LegacyHeatPumpSystemCombination_systemCombinationId_fkey"
FOREIGN KEY ("systemCombinationId") REFERENCES "SystemCombination"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Manufacturers are deduplicated case-insensitively while all PacBrand rows remain untouched.
WITH normalized_brands AS (
  SELECT
    b.*,
    lower(regexp_replace(btrim(b."name"), '\s+', ' ', 'g')) AS normalized_name
  FROM "PacBrand" b
),
grouped_brands AS (
  SELECT
    normalized_name,
    (array_agg("name" ORDER BY "updatedAt" DESC, "id"))[1] AS display_name,
    bool_or("active") AS active,
    min("createdAt") AS created_at,
    max("updatedAt") AS updated_at
  FROM normalized_brands
  GROUP BY normalized_name
)
INSERT INTO "Manufacturer" (
  "id",
  "name",
  "normalizedName",
  "active",
  "createdAt",
  "updatedAt"
)
SELECT
  'manufacturer_' || md5(normalized_name),
  display_name,
  normalized_name,
  active,
  created_at,
  updated_at
FROM grouped_brands;

-- PacRange was removed from the current legacy schema. This guarded block also
-- supports databases that still contain that previously introduced table.
DO $migration$
BEGIN
  IF to_regclass('"PacRange"') IS NOT NULL THEN
    EXECUTE $sql$
      WITH range_candidates AS (
        SELECT
          r.*,
          m."id" AS manufacturer_id,
          lower(regexp_replace(btrim(r."name"), '\s+', ' ', 'g')) AS normalized_name
        FROM "PacRange" r
        JOIN "PacBrand" b ON b."id" = r."brandId"
        JOIN "Manufacturer" m
          ON m."normalizedName" = lower(regexp_replace(btrim(b."name"), '\s+', ' ', 'g'))
      ),
      selected_ranges AS (
        SELECT DISTINCT ON (manufacturer_id, normalized_name)
          *
        FROM range_candidates
        ORDER BY manufacturer_id, normalized_name, "updatedAt" DESC, "id"
      )
      INSERT INTO "ProductRange" (
        "id",
        "manufacturerId",
        "name",
        "normalizedName",
        "legacyPacRangeId",
        "active",
        "createdAt",
        "updatedAt"
      )
      SELECT
        'product_range_' || md5(manufacturer_id || ':' || normalized_name),
        manufacturer_id,
        "name",
        normalized_name,
        "id",
        "active",
        "createdAt",
        "updatedAt"
      FROM selected_ranges
      ON CONFLICT ("manufacturerId", "normalizedName") DO NOTHING
    $sql$;
  END IF;
END
$migration$;

-- Build a temporary, auditable candidate set for physical equipment.
CREATE TEMP TABLE "_HvacEquipmentMigration" ON COMMIT DROP AS
WITH legacy_models AS (
  SELECT
    h.*,
    m."id" AS manufacturer_id
  FROM "HeatPump" h
  JOIN "PacBrand" b ON b."id" = h."brandId"
  JOIN "Manufacturer" m
    ON m."normalizedName" = lower(regexp_replace(btrim(b."name"), '\s+', ' ', 'g'))
)
SELECT
  h."id" AS legacy_heat_pump_id,
  'INDOOR_UNIT'::"EquipmentType" AS role,
  h.manufacturer_id,
  'INDOOR_UNIT'::"EquipmentType" AS equipment_type,
  h."name" || ' — indoor unit' AS equipment_name,
  COALESCE(
    NULLIF(btrim(h."indoorReference"), ''),
    'LEGACY-' || h."id" || '-INDOOR'
  ) AS manufacturer_reference,
  lower(regexp_replace(
    btrim(COALESCE(
      NULLIF(btrim(h."indoorReference"), ''),
      'LEGACY-' || h."id" || '-INDOOR'
    )),
    '\s+',
    '',
    'g'
  )) AS normalized_reference,
  NULLIF(btrim(h."indoorReference"), '') IS NULL AS reference_needs_review,
  h."electricalSupply" AS electrical_supply,
  h."recommendedProtection" AS recommended_protection,
  COALESCE(NULLIF(h."indoorPowerCable", ''), h."powerCable", '') AS power_cable,
  h."communicationCable" AS communication_cable,
  h."refrigerantId" AS refrigerant_id,
  NULL::DOUBLE PRECISION AS factory_charge_kg,
  NULL::DOUBLE PRECISION AS max_pipe_length_m,
  NULL::DOUBLE PRECISION AS max_height_difference_m,
  NULL::DOUBLE PRECISION AS included_pipe_length_m,
  NULL::DOUBLE PRECISION AS additional_charge_g_per_m,
  ''::TEXT AS liquid_pipe_diameter,
  ''::TEXT AS gas_pipe_diameter,
  h."hydraulicConnections" AS hydraulic_connections,
  h."minimumFlow" AS minimum_flow,
  h."minimumWaterVolume" AS minimum_water_volume,
  h."maximumFlowTemperature" AS maximum_flow_temperature,
  h."bufferTankRecommendation" AS buffer_tank_recommendation,
  NULL::DOUBLE PRECISION AS nominal_power_kw,
  h."commissioningNotes" AS commissioning_notes,
  h."installationNotes" AS installation_notes,
  h."internalNotes" AS internal_notes,
  h."active" AS active,
  h."createdAt" AS created_at,
  h."updatedAt" AS updated_at
FROM legacy_models h
WHERE h."configuration" = 'SPLIT'

UNION ALL

SELECT
  h."id",
  'OUTDOOR_UNIT'::"EquipmentType",
  h.manufacturer_id,
  'OUTDOOR_UNIT'::"EquipmentType",
  h."name" || ' — outdoor unit',
  COALESCE(
    NULLIF(btrim(h."outdoorReference"), ''),
    'LEGACY-' || h."id" || '-OUTDOOR'
  ),
  lower(regexp_replace(
    btrim(COALESCE(
      NULLIF(btrim(h."outdoorReference"), ''),
      'LEGACY-' || h."id" || '-OUTDOOR'
    )),
    '\s+',
    '',
    'g'
  )),
  NULLIF(btrim(h."outdoorReference"), '') IS NULL,
  h."electricalSupply",
  h."recommendedProtection",
  COALESCE(NULLIF(h."outdoorPowerCable", ''), h."powerCable", ''),
  h."communicationCable",
  h."refrigerantId",
  h."factoryChargeKg",
  h."maxPipeLengthM",
  h."maxHeightDifferenceM",
  h."includedPipeLengthM",
  h."additionalChargeGPerM",
  h."liquidPipeDiameter",
  h."gasPipeDiameter",
  '',
  '',
  '',
  '',
  '',
  h."powerKw",
  h."commissioningNotes",
  h."installationNotes",
  h."internalNotes",
  h."active",
  h."createdAt",
  h."updatedAt"
FROM legacy_models h
WHERE h."configuration" = 'SPLIT'

UNION ALL

SELECT
  h."id",
  'MONOBLOC'::"EquipmentType",
  h.manufacturer_id,
  'MONOBLOC'::"EquipmentType",
  h."name",
  COALESCE(
    NULLIF(btrim(h."outdoorReference"), ''),
    NULLIF(btrim(h."indoorReference"), ''),
    'LEGACY-' || h."id" || '-MONOBLOC'
  ),
  lower(regexp_replace(
    btrim(COALESCE(
      NULLIF(btrim(h."outdoorReference"), ''),
      NULLIF(btrim(h."indoorReference"), ''),
      'LEGACY-' || h."id" || '-MONOBLOC'
    )),
    '\s+',
    '',
    'g'
  )),
  NULLIF(btrim(h."outdoorReference"), '') IS NULL
    AND NULLIF(btrim(h."indoorReference"), '') IS NULL,
  h."electricalSupply",
  h."recommendedProtection",
  COALESCE(
    NULLIF(h."indoorPowerCable", ''),
    NULLIF(h."powerCable", ''),
    h."outdoorPowerCable",
    ''
  ),
  h."communicationCable",
  h."refrigerantId",
  h."factoryChargeKg",
  h."maxPipeLengthM",
  h."maxHeightDifferenceM",
  h."includedPipeLengthM",
  h."additionalChargeGPerM",
  h."liquidPipeDiameter",
  h."gasPipeDiameter",
  h."hydraulicConnections",
  h."minimumFlow",
  h."minimumWaterVolume",
  h."maximumFlowTemperature",
  h."bufferTankRecommendation",
  h."powerKw",
  h."commissioningNotes",
  h."installationNotes",
  h."internalNotes",
  h."active",
  h."createdAt",
  h."updatedAt"
FROM legacy_models h
WHERE h."configuration" = 'MONOBLOC';

-- One physical manufacturer reference becomes one Equipment row.
WITH selected_equipment AS (
  SELECT DISTINCT ON (manufacturer_id, normalized_reference)
    *
  FROM "_HvacEquipmentMigration"
  ORDER BY
    manufacturer_id,
    normalized_reference,
    reference_needs_review,
    updated_at DESC,
    legacy_heat_pump_id
)
INSERT INTO "Equipment" (
  "id",
  "manufacturerId",
  "type",
  "name",
  "manufacturerReference",
  "normalizedReference",
  "referenceNeedsReview",
  "electricalSupply",
  "recommendedProtection",
  "powerCable",
  "communicationCable",
  "refrigerantId",
  "factoryChargeKg",
  "maxPipeLengthM",
  "maxHeightDifferenceM",
  "includedPipeLengthM",
  "additionalChargeGPerM",
  "liquidPipeDiameter",
  "gasPipeDiameter",
  "hydraulicConnections",
  "minimumFlow",
  "minimumWaterVolume",
  "maximumFlowTemperature",
  "bufferTankRecommendation",
  "nominalPowerKw",
  "commissioningNotes",
  "installationNotes",
  "internalNotes",
  "active",
  "createdAt",
  "updatedAt"
)
SELECT
  'equipment_' || md5(manufacturer_id || ':' || normalized_reference),
  manufacturer_id,
  equipment_type,
  equipment_name,
  manufacturer_reference,
  normalized_reference,
  reference_needs_review,
  electrical_supply,
  recommended_protection,
  power_cable,
  communication_cable,
  refrigerant_id,
  factory_charge_kg,
  max_pipe_length_m,
  max_height_difference_m,
  included_pipe_length_m,
  additional_charge_g_per_m,
  liquid_pipe_diameter,
  gas_pipe_diameter,
  hydraulic_connections,
  minimum_flow,
  minimum_water_volume,
  maximum_flow_temperature,
  buffer_tank_recommendation,
  nominal_power_kw,
  commissioning_notes,
  installation_notes,
  internal_notes,
  active,
  created_at,
  updated_at
FROM selected_equipment;

INSERT INTO "LegacyHeatPumpEquipment" (
  "heatPumpId",
  "equipmentId",
  "role",
  "createdAt"
)
SELECT
  candidate.legacy_heat_pump_id,
  equipment."id",
  candidate.role,
  candidate.created_at
FROM "_HvacEquipmentMigration" candidate
JOIN "Equipment" equipment
  ON equipment."manufacturerId" = candidate.manufacturer_id
  AND equipment."normalizedReference" = candidate.normalized_reference;

-- Split legacy models become reusable combinations. Monoblocs remain standalone.
WITH combination_candidates AS (
  SELECT
    h.*,
    m."id" AS manufacturer_id,
    lower(regexp_replace(btrim(h."name"), '\s+', ' ', 'g')) AS normalized_name
  FROM "HeatPump" h
  JOIN "PacBrand" b ON b."id" = h."brandId"
  JOIN "Manufacturer" m
    ON m."normalizedName" = lower(regexp_replace(btrim(b."name"), '\s+', ' ', 'g'))
  WHERE h."configuration" = 'SPLIT'
),
selected_combinations AS (
  SELECT DISTINCT ON (manufacturer_id, normalized_name)
    *
  FROM combination_candidates
  ORDER BY manufacturer_id, normalized_name, "updatedAt" DESC, "id"
)
INSERT INTO "SystemCombination" (
  "id",
  "manufacturerId",
  "name",
  "normalizedName",
  "applicationType",
  "splitLiaisonType",
  "electricalSupply",
  "nominalPowerKw",
  "commissioningNotes",
  "installationNotes",
  "internalNotes",
  "active",
  "createdAt",
  "updatedAt"
)
SELECT
  'system_combination_' || md5(manufacturer_id || ':' || normalized_name),
  manufacturer_id,
  "name",
  normalized_name,
  "type",
  "splitLiaisonType",
  "electricalSupply",
  "powerKw",
  "commissioningNotes",
  "installationNotes",
  "internalNotes",
  "active",
  "createdAt",
  "updatedAt"
FROM selected_combinations;

INSERT INTO "LegacyHeatPumpSystemCombination" (
  "heatPumpId",
  "systemCombinationId",
  "createdAt"
)
SELECT
  h."id",
  combination."id",
  h."createdAt"
FROM "HeatPump" h
JOIN "PacBrand" b ON b."id" = h."brandId"
JOIN "Manufacturer" manufacturer
  ON manufacturer."normalizedName" = lower(regexp_replace(btrim(b."name"), '\s+', ' ', 'g'))
JOIN "SystemCombination" combination
  ON combination."manufacturerId" = manufacturer."id"
  AND combination."normalizedName" = lower(regexp_replace(btrim(h."name"), '\s+', ' ', 'g'))
WHERE h."configuration" = 'SPLIT';

INSERT INTO "CombinationComponent" (
  "id",
  "systemCombinationId",
  "equipmentId",
  "role",
  "quantity",
  "position",
  "required",
  "createdAt"
)
SELECT
  'combination_component_' || md5(
    combination_mapping."systemCombinationId"
    || ':'
    || equipment_mapping."equipmentId"
  ),
  combination_mapping."systemCombinationId",
  equipment_mapping."equipmentId",
  equipment_mapping."role",
  1,
  CASE equipment_mapping."role"
    WHEN 'INDOOR_UNIT'::"EquipmentType" THEN 0
    WHEN 'OUTDOOR_UNIT'::"EquipmentType" THEN 1
    ELSE 2
  END,
  true,
  equipment_mapping."createdAt"
FROM "LegacyHeatPumpSystemCombination" combination_mapping
JOIN "LegacyHeatPumpEquipment" equipment_mapping
  ON equipment_mapping."heatPumpId" = combination_mapping."heatPumpId"
WHERE equipment_mapping."role" IN (
  'INDOOR_UNIT'::"EquipmentType",
  'OUTDOOR_UNIT'::"EquipmentType"
)
ON CONFLICT ("systemCombinationId", "equipmentId") DO NOTHING;

-- Preserve optional range assignments on databases that still have PacRange.
DO $migration$
BEGIN
  IF to_regclass('"PacRange"') IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'HeatPump'
        AND column_name = 'rangeId'
    )
  THEN
    EXECUTE $sql$
      UPDATE "Equipment" equipment
      SET "productRangeId" = product_range."id"
      FROM "LegacyHeatPumpEquipment" mapping
      JOIN "HeatPump" heat_pump ON heat_pump."id" = mapping."heatPumpId"
      JOIN "PacRange" legacy_range ON legacy_range."id" = heat_pump."rangeId"
      JOIN "PacBrand" brand ON brand."id" = legacy_range."brandId"
      JOIN "Manufacturer" manufacturer
        ON manufacturer."normalizedName" = lower(regexp_replace(btrim(brand."name"), '\s+', ' ', 'g'))
      JOIN "ProductRange" product_range
        ON product_range."manufacturerId" = manufacturer."id"
        AND product_range."normalizedName" = lower(regexp_replace(btrim(legacy_range."name"), '\s+', ' ', 'g'))
      WHERE equipment."id" = mapping."equipmentId"
    $sql$;

    EXECUTE $sql$
      UPDATE "SystemCombination" combination
      SET "productRangeId" = product_range."id"
      FROM "LegacyHeatPumpSystemCombination" mapping
      JOIN "HeatPump" heat_pump ON heat_pump."id" = mapping."heatPumpId"
      JOIN "PacRange" legacy_range ON legacy_range."id" = heat_pump."rangeId"
      JOIN "PacBrand" brand ON brand."id" = legacy_range."brandId"
      JOIN "Manufacturer" manufacturer
        ON manufacturer."normalizedName" = lower(regexp_replace(btrim(brand."name"), '\s+', ' ', 'g'))
      JOIN "ProductRange" product_range
        ON product_range."manufacturerId" = manufacturer."id"
        AND product_range."normalizedName" = lower(regexp_replace(btrim(legacy_range."name"), '\s+', ' ', 'g'))
      WHERE combination."id" = mapping."systemCombinationId"
    $sql$;
  END IF;
END
$migration$;

-- Reuse the existing stored file; only metadata and associations are copied.
INSERT INTO "TechnicalDocument" (
  "id",
  "legacyPacDocumentId",
  "title",
  "type",
  "originalFileName",
  "storageName",
  "mimeType",
  "sizeBytes",
  "version",
  "documentDate",
  "isPrimary",
  "active",
  "createdAt",
  "updatedAt"
)
SELECT
  'technical_document_' || md5(document."id"),
  document."id",
  document."name",
  document."type"::TEXT::"TechnicalDocumentType",
  document."originalName",
  document."storageName",
  document."mimeType",
  document."sizeBytes",
  document."version",
  document."documentDate",
  document."primary",
  true,
  document."createdAt",
  document."createdAt"
FROM "PacDocument" document;

INSERT INTO "SystemCombinationTechnicalDocument" (
  "systemCombinationId",
  "technicalDocumentId",
  "createdAt"
)
SELECT
  combination_mapping."systemCombinationId",
  technical_document."id",
  legacy_document."createdAt"
FROM "PacDocument" legacy_document
JOIN "TechnicalDocument" technical_document
  ON technical_document."legacyPacDocumentId" = legacy_document."id"
JOIN "LegacyHeatPumpSystemCombination" combination_mapping
  ON combination_mapping."heatPumpId" = legacy_document."heatPumpId";

INSERT INTO "EquipmentTechnicalDocument" (
  "equipmentId",
  "technicalDocumentId",
  "createdAt"
)
SELECT
  equipment_mapping."equipmentId",
  technical_document."id",
  legacy_document."createdAt"
FROM "PacDocument" legacy_document
JOIN "TechnicalDocument" technical_document
  ON technical_document."legacyPacDocumentId" = legacy_document."id"
JOIN "LegacyHeatPumpEquipment" equipment_mapping
  ON equipment_mapping."heatPumpId" = legacy_document."heatPumpId"
  AND equipment_mapping."role" = 'MONOBLOC'::"EquipmentType";

COMMIT;
