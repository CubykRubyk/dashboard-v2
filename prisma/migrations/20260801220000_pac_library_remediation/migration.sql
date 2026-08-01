BEGIN;

-- A legacy document is only a traceability source. Removing that source must
-- detach the trace without deleting the new technical document.
ALTER TABLE "TechnicalDocument"
DROP CONSTRAINT "TechnicalDocument_legacyPacDocumentId_fkey";

ALTER TABLE "TechnicalDocument"
ADD CONSTRAINT "TechnicalDocument_legacyPacDocumentId_fkey"
FOREIGN KEY ("legacyPacDocumentId") REFERENCES "PacDocument"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- The first migration deduplicated equipment by manufacturer reference. In
-- the exceptional case where a legacy indoor and outdoor unit shared the same
-- reference, both trace rows could point to one Equipment with only one type.
-- Create an explicit review copy for the mismatched role and move only the
-- affected trace rows to it. HeatPump and the original Equipment remain intact.
INSERT INTO "Equipment" (
  "id",
  "manufacturerId",
  "productRangeId",
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
SELECT DISTINCT
  'equipment_role_repair_' || md5(
    equipment."id" || ':' || mapping."role"::TEXT
  ),
  equipment."manufacturerId",
  equipment."productRangeId",
  mapping."role",
  equipment."name" || CASE mapping."role"
    WHEN 'INDOOR_UNIT'::"EquipmentType" THEN ' — indoor legacy review'
    ELSE ' — outdoor legacy review'
  END,
  equipment."manufacturerReference" || CASE mapping."role"
    WHEN 'INDOOR_UNIT'::"EquipmentType" THEN '-LEGACY-INDOOR'
    ELSE '-LEGACY-OUTDOOR'
  END,
  lower(regexp_replace(
    btrim(equipment."manufacturerReference" || CASE mapping."role"
      WHEN 'INDOOR_UNIT'::"EquipmentType" THEN '-LEGACY-INDOOR'
      ELSE '-LEGACY-OUTDOOR'
    END),
    '\s+',
    '',
    'g'
  )),
  true,
  equipment."electricalSupply",
  equipment."recommendedProtection",
  equipment."powerCable",
  equipment."communicationCable",
  equipment."refrigerantId",
  equipment."factoryChargeKg",
  equipment."maxPipeLengthM",
  equipment."maxHeightDifferenceM",
  equipment."includedPipeLengthM",
  equipment."additionalChargeGPerM",
  equipment."liquidPipeDiameter",
  equipment."gasPipeDiameter",
  equipment."hydraulicConnections",
  equipment."minimumFlow",
  equipment."minimumWaterVolume",
  equipment."maximumFlowTemperature",
  equipment."bufferTankRecommendation",
  equipment."nominalPowerKw",
  equipment."commissioningNotes",
  equipment."installationNotes",
  equipment."internalNotes",
  equipment."active",
  equipment."createdAt",
  CURRENT_TIMESTAMP
FROM "LegacyHeatPumpEquipment" mapping
JOIN "Equipment" equipment ON equipment."id" = mapping."equipmentId"
WHERE mapping."role" IN (
  'INDOOR_UNIT'::"EquipmentType",
  'OUTDOOR_UNIT'::"EquipmentType"
)
AND equipment."type" <> mapping."role"
ON CONFLICT ("manufacturerId", "normalizedReference") DO NOTHING;

UPDATE "LegacyHeatPumpEquipment" mapping
SET "equipmentId" = repaired."id"
FROM "Equipment" current_equipment, "Equipment" repaired
WHERE current_equipment."id" = mapping."equipmentId"
  AND repaired."id" = 'equipment_role_repair_' || md5(
    current_equipment."id" || ':' || mapping."role"::TEXT
  )
  AND mapping."role" IN (
    'INDOOR_UNIT'::"EquipmentType",
    'OUTDOOR_UNIT'::"EquipmentType"
  )
  AND current_equipment."type" <> mapping."role";

-- Rebuild only invalid migrated combinations from the same canonical legacy
-- HeatPump selected by the original migration (latest update, then id).
CREATE TEMP TABLE "_InvalidLegacyCombinations" ON COMMIT DROP AS
SELECT combination."id"
FROM "SystemCombination" combination
JOIN "LegacyHeatPumpSystemCombination" legacy
  ON legacy."systemCombinationId" = combination."id"
LEFT JOIN "CombinationComponent" component
  ON component."systemCombinationId" = combination."id"
LEFT JOIN "Equipment" equipment ON equipment."id" = component."equipmentId"
GROUP BY combination."id"
HAVING
  COUNT(*) FILTER (
    WHERE component."role" = 'INDOOR_UNIT'::"EquipmentType"
      AND equipment."type" = 'INDOOR_UNIT'::"EquipmentType"
  ) <> 1
  OR COUNT(*) FILTER (
    WHERE component."role" = 'OUTDOOR_UNIT'::"EquipmentType"
      AND equipment."type" = 'OUTDOOR_UNIT'::"EquipmentType"
  ) <> 1
  OR COUNT(*) FILTER (
    WHERE component."role" NOT IN (
      'INDOOR_UNIT'::"EquipmentType",
      'OUTDOOR_UNIT'::"EquipmentType"
    )
      OR component."role" <> equipment."type"
  ) <> 0;

DELETE FROM "CombinationComponent" component
USING "_InvalidLegacyCombinations" invalid
WHERE component."systemCombinationId" = invalid."id";

WITH ranked_legacy AS (
  SELECT
    mapping."systemCombinationId",
    mapping."heatPumpId",
    row_number() OVER (
      PARTITION BY mapping."systemCombinationId"
      ORDER BY heat_pump."updatedAt" DESC, heat_pump."id"
    ) AS candidate_rank
  FROM "LegacyHeatPumpSystemCombination" mapping
  JOIN "HeatPump" heat_pump ON heat_pump."id" = mapping."heatPumpId"
  JOIN "_InvalidLegacyCombinations" invalid
    ON invalid."id" = mapping."systemCombinationId"
),
canonical_legacy AS (
  SELECT "systemCombinationId", "heatPumpId"
  FROM ranked_legacy
  WHERE candidate_rank = 1
)
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
  'combination_component_repair_' || md5(
    canonical."systemCombinationId" || ':' || mapping."role"::TEXT
  ),
  canonical."systemCombinationId",
  mapping."equipmentId",
  mapping."role",
  1,
  CASE mapping."role"
    WHEN 'INDOOR_UNIT'::"EquipmentType" THEN 0
    ELSE 1
  END,
  true,
  CURRENT_TIMESTAMP
FROM canonical_legacy canonical
JOIN "LegacyHeatPumpEquipment" mapping
  ON mapping."heatPumpId" = canonical."heatPumpId"
JOIN "Equipment" equipment
  ON equipment."id" = mapping."equipmentId"
  AND equipment."type" = mapping."role"
WHERE mapping."role" IN (
  'INDOOR_UNIT'::"EquipmentType",
  'OUTDOOR_UNIT'::"EquipmentType"
);

-- Abort rather than silently accepting or deleting an unrepairable,
-- non-legacy invalid combination.
DO $validation$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "SystemCombination" combination
    LEFT JOIN "CombinationComponent" component
      ON component."systemCombinationId" = combination."id"
    LEFT JOIN "Equipment" equipment
      ON equipment."id" = component."equipmentId"
    GROUP BY combination."id"
    HAVING
      COUNT(*) FILTER (
        WHERE component."role" = 'INDOOR_UNIT'::"EquipmentType"
          AND equipment."type" = 'INDOOR_UNIT'::"EquipmentType"
      ) <> 1
      OR COUNT(*) FILTER (
        WHERE component."role" = 'OUTDOOR_UNIT'::"EquipmentType"
          AND equipment."type" = 'OUTDOOR_UNIT'::"EquipmentType"
      ) <> 1
      OR COUNT(*) FILTER (
        WHERE component."role" NOT IN (
          'INDOOR_UNIT'::"EquipmentType",
          'OUTDOOR_UNIT'::"EquipmentType"
        )
          OR component."role" <> equipment."type"
          OR component."quantity" <> 1
          OR component."required" IS NOT TRUE
      ) <> 0
  ) THEN
    RAISE EXCEPTION
      'HVAC remediation stopped: a system combination cannot be repaired automatically';
  END IF;
END
$validation$;

CREATE UNIQUE INDEX "CombinationComponent_systemCombinationId_role_key"
ON "CombinationComponent"("systemCombinationId", "role");

ALTER TABLE "CombinationComponent"
ADD CONSTRAINT "CombinationComponent_split_roles_check"
CHECK (
  "role" IN (
    'INDOOR_UNIT'::"EquipmentType",
    'OUTDOOR_UNIT'::"EquipmentType"
  )
  AND "quantity" = 1
  AND "required" IS TRUE
);

-- A deferred constraint trigger allows Prisma to replace both components
-- atomically while still enforcing the final state at transaction commit.
CREATE FUNCTION "validateSystemCombinationComponents"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
DECLARE
  combination_id TEXT;
  indoor_count INTEGER;
  outdoor_count INTEGER;
  invalid_count INTEGER;
BEGIN
  IF TG_TABLE_NAME = 'SystemCombination' THEN
    combination_id := NEW."id";
  ELSE
    combination_id := COALESCE(NEW."systemCombinationId", OLD."systemCombinationId");
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM "SystemCombination" WHERE "id" = combination_id
  ) THEN
    RETURN NULL;
  END IF;

  SELECT
    COUNT(*) FILTER (
      WHERE component."role" = 'INDOOR_UNIT'::"EquipmentType"
    ),
    COUNT(*) FILTER (
      WHERE component."role" = 'OUTDOOR_UNIT'::"EquipmentType"
    ),
    COUNT(*) FILTER (
      WHERE component."role" <> equipment."type"
        OR component."role" NOT IN (
          'INDOOR_UNIT'::"EquipmentType",
          'OUTDOOR_UNIT'::"EquipmentType"
        )
        OR component."quantity" <> 1
        OR component."required" IS NOT TRUE
    )
  INTO indoor_count, outdoor_count, invalid_count
  FROM "CombinationComponent" component
  JOIN "Equipment" equipment ON equipment."id" = component."equipmentId"
  WHERE component."systemCombinationId" = combination_id;

  IF indoor_count <> 1 OR outdoor_count <> 1 OR invalid_count <> 0 THEN
    RAISE EXCEPTION
      'SystemCombination % must contain exactly one indoor and one outdoor unit',
      combination_id
      USING ERRCODE = '23514';
  END IF;

  RETURN NULL;
END
$function$;

CREATE CONSTRAINT TRIGGER "SystemCombination_components_valid"
AFTER INSERT ON "SystemCombination"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "validateSystemCombinationComponents"();

CREATE CONSTRAINT TRIGGER "CombinationComponent_combination_valid"
AFTER INSERT OR UPDATE OR DELETE ON "CombinationComponent"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "validateSystemCombinationComponents"();

COMMIT;
