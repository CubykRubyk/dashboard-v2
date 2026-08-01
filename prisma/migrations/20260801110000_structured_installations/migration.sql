-- Preserve delivery provenance for catalog materials.
ALTER TABLE "WorkSheetItem"
ADD COLUMN "sourceSupplier" TEXT NOT NULL DEFAULT '',
ADD COLUMN "deliveryNote" TEXT NOT NULL DEFAULT '';

-- Store principal installations as structured, historical rows.
CREATE TABLE "WorkSheetInstallation" (
    "id" TEXT NOT NULL,
    "workSheetId" TEXT NOT NULL,
    "designationSnapshot" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "supplier" "MaterialSupplier" NOT NULL DEFAULT 'INTERNAL',
    "sourceSupplier" TEXT NOT NULL DEFAULT '',
    "deliveryNote" TEXT NOT NULL DEFAULT '',
    "installed" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkSheetInstallation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkSheetInstallation_workSheetId_position_idx"
ON "WorkSheetInstallation"("workSheetId", "position");

ALTER TABLE "WorkSheetInstallation"
ADD CONSTRAINT "WorkSheetInstallation_workSheetId_fkey"
FOREIGN KEY ("workSheetId") REFERENCES "WorkSheet"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
