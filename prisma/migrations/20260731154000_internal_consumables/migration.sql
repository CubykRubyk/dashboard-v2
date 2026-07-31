UPDATE "Material"
SET
  "allowSupplier" = false,
  "allowNotInstalled" = false
WHERE "categoryId" IN (
  SELECT "id"
  FROM "MaterialCategory"
  WHERE "key" IN ('cables', 'liaisons', 'isolation', 'multicouche', 'raccords')
);
