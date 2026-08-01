-- Delivery provenance belongs only to principal installations.
ALTER TABLE "WorkSheetItem"
DROP COLUMN "sourceSupplier",
DROP COLUMN "deliveryNote";

-- These catalog entries are services, not supplied materials.
UPDATE "Material"
SET "allowSupplier" = false,
    "allowNotInstalled" = false
WHERE "key" IN ('desembouage', 'dalle');
