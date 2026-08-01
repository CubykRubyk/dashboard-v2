CREATE TABLE "PacRange" (
  "id" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PacRange_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "HeatPump"
ADD COLUMN "rangeId" TEXT;

ALTER TABLE "PacDocument"
ADD COLUMN "rangeId" TEXT,
ADD COLUMN "language" TEXT NOT NULL DEFAULT 'FR';

CREATE TABLE "PacDocumentHeatPump" (
  "documentId" TEXT NOT NULL,
  "heatPumpId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PacDocumentHeatPump_pkey" PRIMARY KEY ("documentId", "heatPumpId")
);

-- Preserve every existing document and its current model assignment.
INSERT INTO "PacDocumentHeatPump" ("documentId", "heatPumpId")
SELECT "id", "heatPumpId"
FROM "PacDocument";

ALTER TABLE "PacDocument"
DROP CONSTRAINT "PacDocument_heatPumpId_fkey";

DROP INDEX "PacDocument_heatPumpId_type_idx";

ALTER TABLE "PacDocument"
DROP COLUMN "heatPumpId";

CREATE UNIQUE INDEX "PacRange_brandId_name_key" ON "PacRange"("brandId", "name");
CREATE INDEX "PacRange_brandId_active_idx" ON "PacRange"("brandId", "active");
CREATE INDEX "HeatPump_rangeId_idx" ON "HeatPump"("rangeId");
CREATE INDEX "PacDocument_rangeId_type_idx" ON "PacDocument"("rangeId", "type");
CREATE INDEX "PacDocumentHeatPump_heatPumpId_idx" ON "PacDocumentHeatPump"("heatPumpId");

ALTER TABLE "PacRange"
ADD CONSTRAINT "PacRange_brandId_fkey"
FOREIGN KEY ("brandId") REFERENCES "PacBrand"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "HeatPump"
ADD CONSTRAINT "HeatPump_rangeId_fkey"
FOREIGN KEY ("rangeId") REFERENCES "PacRange"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PacDocument"
ADD CONSTRAINT "PacDocument_rangeId_fkey"
FOREIGN KEY ("rangeId") REFERENCES "PacRange"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PacDocumentHeatPump"
ADD CONSTRAINT "PacDocumentHeatPump_documentId_fkey"
FOREIGN KEY ("documentId") REFERENCES "PacDocument"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PacDocumentHeatPump"
ADD CONSTRAINT "PacDocumentHeatPump_heatPumpId_fkey"
FOREIGN KEY ("heatPumpId") REFERENCES "HeatPump"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
