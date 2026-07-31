CREATE TYPE "HeatPumpType" AS ENUM ('AIR_WATER', 'AIR_AIR', 'GROUND_WATER');
CREATE TYPE "HeatPumpConfiguration" AS ENUM ('SPLIT', 'MONOBLOC');
CREATE TYPE "ElectricalSupply" AS ENUM ('SINGLE_PHASE', 'THREE_PHASE');
CREATE TYPE "PacDocumentType" AS ENUM ('INSTALLATION_MANUAL', 'USER_MANUAL', 'DATASHEET', 'WIRING_DIAGRAM', 'ERROR_CODES', 'CERTIFICATE', 'OTHER');

CREATE TABLE "PacBrand" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PacBrand_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Refrigerant" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "gwp" DOUBLE PRECISION NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Refrigerant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HeatPump" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "type" "HeatPumpType" NOT NULL DEFAULT 'AIR_WATER',
  "configuration" "HeatPumpConfiguration" NOT NULL DEFAULT 'SPLIT',
  "electricalSupply" "ElectricalSupply" NOT NULL DEFAULT 'SINGLE_PHASE',
  "powerKw" DOUBLE PRECISION,
  "outdoorReference" TEXT NOT NULL DEFAULT '',
  "indoorReference" TEXT NOT NULL DEFAULT '',
  "refrigerantId" TEXT,
  "factoryChargeKg" DOUBLE PRECISION,
  "maxPipeLengthM" DOUBLE PRECISION,
  "maxHeightDifferenceM" DOUBLE PRECISION,
  "includedPipeLengthM" DOUBLE PRECISION,
  "additionalChargeGPerM" DOUBLE PRECISION,
  "liquidPipeDiameter" TEXT NOT NULL DEFAULT '',
  "gasPipeDiameter" TEXT NOT NULL DEFAULT '',
  "powerCable" TEXT NOT NULL DEFAULT '',
  "recommendedProtection" TEXT NOT NULL DEFAULT '',
  "communicationCable" TEXT NOT NULL DEFAULT '',
  "hydraulicConnections" TEXT NOT NULL DEFAULT '',
  "minimumFlow" TEXT NOT NULL DEFAULT '',
  "minimumWaterVolume" TEXT NOT NULL DEFAULT '',
  "maximumFlowTemperature" TEXT NOT NULL DEFAULT '',
  "bufferTankRecommendation" TEXT NOT NULL DEFAULT '',
  "commissioningNotes" TEXT NOT NULL DEFAULT '',
  "installationNotes" TEXT NOT NULL DEFAULT '',
  "internalNotes" TEXT NOT NULL DEFAULT '',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HeatPump_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PacDocument" (
  "id" TEXT NOT NULL,
  "heatPumpId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "PacDocumentType" NOT NULL DEFAULT 'OTHER',
  "originalName" TEXT NOT NULL,
  "storageName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "version" TEXT NOT NULL DEFAULT '',
  "documentDate" TIMESTAMP(3),
  "primary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PacDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PacBrand_name_key" ON "PacBrand"("name");
CREATE UNIQUE INDEX "Refrigerant_name_key" ON "Refrigerant"("name");
CREATE UNIQUE INDEX "HeatPump_brandId_name_key" ON "HeatPump"("brandId", "name");
CREATE INDEX "HeatPump_brandId_active_idx" ON "HeatPump"("brandId", "active");
CREATE INDEX "HeatPump_refrigerantId_idx" ON "HeatPump"("refrigerantId");
CREATE UNIQUE INDEX "PacDocument_storageName_key" ON "PacDocument"("storageName");
CREATE INDEX "PacDocument_heatPumpId_type_idx" ON "PacDocument"("heatPumpId", "type");

ALTER TABLE "HeatPump" ADD CONSTRAINT "HeatPump_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "PacBrand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HeatPump" ADD CONSTRAINT "HeatPump_refrigerantId_fkey" FOREIGN KEY ("refrigerantId") REFERENCES "Refrigerant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PacDocument" ADD CONSTRAINT "PacDocument_heatPumpId_fkey" FOREIGN KEY ("heatPumpId") REFERENCES "HeatPump"("id") ON DELETE CASCADE ON UPDATE CASCADE;
