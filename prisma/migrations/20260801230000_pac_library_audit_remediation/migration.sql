BEGIN;

-- The previous remediation guarantees one valid indoor and one valid outdoor
-- component per split combination. Re-check before deriving the canonical pair
-- columns. Invalid or duplicate data aborts the whole migration without
-- deleting or rewriting any business row.
DO $preflight$
DECLARE
  invalid_ids TEXT;
  duplicate_pairs TEXT;
BEGIN
  SELECT string_agg(invalid."id", ', ' ORDER BY invalid."id")
  INTO invalid_ids
  FROM (
    SELECT combination."id"
    FROM "SystemCombination" combination
    LEFT JOIN "CombinationComponent" component
      ON component."systemCombinationId" = combination."id"
    LEFT JOIN "Equipment" equipment
      ON equipment."id" = component."equipmentId"
    GROUP BY combination."id", combination."manufacturerId"
    HAVING
      COUNT(*) <> 2
      OR COUNT(*) FILTER (
        WHERE component."role" = 'INDOOR_UNIT'::"EquipmentType"
          AND equipment."type" = 'INDOOR_UNIT'::"EquipmentType"
          AND equipment."manufacturerId" = combination."manufacturerId"
          AND component."quantity" = 1
          AND component."required" IS TRUE
      ) <> 1
      OR COUNT(*) FILTER (
        WHERE component."role" = 'OUTDOOR_UNIT'::"EquipmentType"
          AND equipment."type" = 'OUTDOOR_UNIT'::"EquipmentType"
          AND equipment."manufacturerId" = combination."manufacturerId"
          AND component."quantity" = 1
          AND component."required" IS TRUE
      ) <> 1
  ) invalid;

  IF invalid_ids IS NOT NULL THEN
    RAISE EXCEPTION
      'HVAC pair migration preflight failed; invalid combinations: %',
      invalid_ids
      USING ERRCODE = '23514';
  END IF;

  SELECT string_agg(
    pairs."indoorEquipmentId" || '+' || pairs."outdoorEquipmentId"
      || ' [' || pairs."combinationIds" || ']',
    '; '
    ORDER BY pairs."indoorEquipmentId", pairs."outdoorEquipmentId"
  )
  INTO duplicate_pairs
  FROM (
    SELECT
      identity."indoorEquipmentId",
      identity."outdoorEquipmentId",
      string_agg(identity."combinationId", ', ' ORDER BY identity."combinationId")
        AS "combinationIds"
    FROM (
      SELECT
        combination."id" AS "combinationId",
        MAX(component."equipmentId") FILTER (
          WHERE component."role" = 'INDOOR_UNIT'::"EquipmentType"
        ) AS "indoorEquipmentId",
        MAX(component."equipmentId") FILTER (
          WHERE component."role" = 'OUTDOOR_UNIT'::"EquipmentType"
        ) AS "outdoorEquipmentId"
      FROM "SystemCombination" combination
      JOIN "CombinationComponent" component
        ON component."systemCombinationId" = combination."id"
      GROUP BY combination."id"
    ) identity
    GROUP BY identity."indoorEquipmentId", identity."outdoorEquipmentId"
    HAVING COUNT(*) > 1
  ) pairs;

  IF duplicate_pairs IS NOT NULL THEN
    RAISE EXCEPTION
      'HVAC pair migration preflight failed; duplicate UI/UE pairs: %',
      duplicate_pairs
      USING ERRCODE = '23505';
  END IF;
END
$preflight$;

ALTER TABLE "SystemCombination"
ADD COLUMN "indoorEquipmentId" TEXT,
ADD COLUMN "outdoorEquipmentId" TEXT;

WITH identity AS (
  SELECT
    combination."id",
    MAX(component."equipmentId") FILTER (
      WHERE component."role" = 'INDOOR_UNIT'::"EquipmentType"
    ) AS "indoorEquipmentId",
    MAX(component."equipmentId") FILTER (
      WHERE component."role" = 'OUTDOOR_UNIT'::"EquipmentType"
    ) AS "outdoorEquipmentId"
  FROM "SystemCombination" combination
  JOIN "CombinationComponent" component
    ON component."systemCombinationId" = combination."id"
  GROUP BY combination."id"
)
UPDATE "SystemCombination" combination
SET
  "indoorEquipmentId" = identity."indoorEquipmentId",
  "outdoorEquipmentId" = identity."outdoorEquipmentId"
FROM identity
WHERE identity."id" = combination."id";

ALTER TABLE "SystemCombination"
ALTER COLUMN "indoorEquipmentId" SET NOT NULL,
ALTER COLUMN "outdoorEquipmentId" SET NOT NULL;

ALTER TABLE "SystemCombination"
ADD CONSTRAINT "SystemCombination_distinct_pair_check"
CHECK ("indoorEquipmentId" <> "outdoorEquipmentId");

ALTER TABLE "SystemCombination"
ADD CONSTRAINT "SystemCombination_indoorEquipmentId_fkey"
FOREIGN KEY ("indoorEquipmentId") REFERENCES "Equipment"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SystemCombination"
ADD CONSTRAINT "SystemCombination_outdoorEquipmentId_fkey"
FOREIGN KEY ("outdoorEquipmentId") REFERENCES "Equipment"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX
  "SystemCombination_indoorEquipmentId_outdoorEquipmentId_key"
ON "SystemCombination"("indoorEquipmentId", "outdoorEquipmentId");

CREATE INDEX "SystemCombination_indoorEquipmentId_idx"
ON "SystemCombination"("indoorEquipmentId");

CREATE INDEX "SystemCombination_outdoorEquipmentId_idx"
ON "SystemCombination"("outdoorEquipmentId");

-- A refrigerant referenced by the new technical catalog is reference data and
-- cannot be deleted by silently nulling Equipment.refrigerantId.
ALTER TABLE "Equipment"
DROP CONSTRAINT "Equipment_refrigerantId_fkey";

ALTER TABLE "Equipment"
ADD CONSTRAINT "Equipment_refrigerantId_fkey"
FOREIGN KEY ("refrigerantId") REFERENCES "Refrigerant"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

DROP TRIGGER IF EXISTS "CombinationComponent_combination_valid"
ON "CombinationComponent";
DROP TRIGGER IF EXISTS "SystemCombination_components_valid"
ON "SystemCombination";
DROP FUNCTION IF EXISTS "validateSystemCombinationComponents"();

CREATE FUNCTION "assertSystemCombinationValid"(combination_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $function$
DECLARE
  combination_record RECORD;
  component_count INTEGER;
  indoor_count INTEGER;
  outdoor_count INTEGER;
  invalid_count INTEGER;
  indoor_component_id TEXT;
  outdoor_component_id TEXT;
BEGIN
  SELECT
    combination."manufacturerId",
    combination."productRangeId",
    combination."indoorEquipmentId",
    combination."outdoorEquipmentId"
  INTO combination_record
  FROM "SystemCombination" combination
  WHERE combination."id" = combination_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (
      WHERE component."role" = 'INDOOR_UNIT'::"EquipmentType"
    ),
    COUNT(*) FILTER (
      WHERE component."role" = 'OUTDOOR_UNIT'::"EquipmentType"
    ),
    COUNT(*) FILTER (
      WHERE equipment."id" IS NULL
        OR component."role" NOT IN (
          'INDOOR_UNIT'::"EquipmentType",
          'OUTDOOR_UNIT'::"EquipmentType"
        )
        OR component."role" <> equipment."type"
        OR equipment."manufacturerId" <> combination_record."manufacturerId"
        OR component."quantity" <> 1
        OR component."required" IS NOT TRUE
    ),
    MAX(component."equipmentId") FILTER (
      WHERE component."role" = 'INDOOR_UNIT'::"EquipmentType"
    ),
    MAX(component."equipmentId") FILTER (
      WHERE component."role" = 'OUTDOOR_UNIT'::"EquipmentType"
    )
  INTO
    component_count,
    indoor_count,
    outdoor_count,
    invalid_count,
    indoor_component_id,
    outdoor_component_id
  FROM "CombinationComponent" component
  LEFT JOIN "Equipment" equipment ON equipment."id" = component."equipmentId"
  WHERE component."systemCombinationId" = combination_id;

  IF component_count <> 2
    OR indoor_count <> 1
    OR outdoor_count <> 1
    OR invalid_count <> 0
    OR indoor_component_id IS DISTINCT FROM
      combination_record."indoorEquipmentId"
    OR outdoor_component_id IS DISTINCT FROM
      combination_record."outdoorEquipmentId"
    OR combination_record."indoorEquipmentId"
      = combination_record."outdoorEquipmentId"
  THEN
    RAISE EXCEPTION
      'SystemCombination % must contain exactly one canonical indoor and one canonical outdoor unit',
      combination_id
      USING ERRCODE = '23514';
  END IF;

  IF combination_record."productRangeId" IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM "ProductRange" product_range
      WHERE product_range."id" = combination_record."productRangeId"
        AND product_range."manufacturerId"
          = combination_record."manufacturerId"
    )
  THEN
    RAISE EXCEPTION
      'SystemCombination % uses a product range from another manufacturer',
      combination_id
      USING ERRCODE = '23514';
  END IF;
END
$function$;

CREATE FUNCTION "validateSystemCombinationRow"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM "assertSystemCombinationValid"(NEW."id");
  RETURN NULL;
END
$function$;

CREATE FUNCTION "validateCombinationComponentChange"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM "assertSystemCombinationValid"(OLD."systemCombinationId");
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM "assertSystemCombinationValid"(NEW."systemCombinationId");
  END IF;
  RETURN NULL;
END
$function$;

CREATE FUNCTION "validateEquipmentCombinationChange"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
DECLARE
  affected_combination_id TEXT;
BEGIN
  FOR affected_combination_id IN
    SELECT DISTINCT affected."systemCombinationId"
    FROM (
      SELECT component."systemCombinationId"
      FROM "CombinationComponent" component
      WHERE component."equipmentId" = NEW."id"
      UNION
      SELECT combination."id"
      FROM "SystemCombination" combination
      WHERE combination."indoorEquipmentId" = NEW."id"
        OR combination."outdoorEquipmentId" = NEW."id"
    ) affected
  LOOP
    PERFORM "assertSystemCombinationValid"(affected_combination_id);
  END LOOP;
  RETURN NULL;
END
$function$;

CREATE CONSTRAINT TRIGGER "SystemCombination_components_valid"
AFTER INSERT OR UPDATE ON "SystemCombination"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "validateSystemCombinationRow"();

CREATE CONSTRAINT TRIGGER "CombinationComponent_combination_valid"
AFTER INSERT OR UPDATE OR DELETE ON "CombinationComponent"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "validateCombinationComponentChange"();

CREATE CONSTRAINT TRIGGER "Equipment_combinations_valid"
AFTER UPDATE ON "Equipment"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "validateEquipmentCombinationChange"();

COMMIT;
