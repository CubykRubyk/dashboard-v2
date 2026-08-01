CREATE TYPE "HeatPumpSplitLiaisonType" AS ENUM ('FRIGORIFIC', 'HYDRAULIC');

ALTER TABLE "HeatPump"
ADD COLUMN "splitLiaisonType" "HeatPumpSplitLiaisonType",
ADD COLUMN "indoorPowerCable" TEXT NOT NULL DEFAULT '',
ADD COLUMN "outdoorPowerCable" TEXT NOT NULL DEFAULT '';

UPDATE "HeatPump"
SET "indoorPowerCable" = "powerCable"
WHERE "powerCable" <> '';
