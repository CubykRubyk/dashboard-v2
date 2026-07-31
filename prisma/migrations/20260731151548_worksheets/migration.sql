-- CreateEnum
CREATE TYPE "WorkSheetStatus" AS ENUM ('DRAFT', 'COMPLETED', 'SENT');

-- CreateEnum
CREATE TYPE "MaterialSupplier" AS ENUM ('COMPANY', 'INTERNAL');

-- CreateTable
CREATE TABLE "WorkSheet" (
    "id" TEXT NOT NULL,
    "workDate" TIMESTAMP(3),
    "client" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "installer" TEXT NOT NULL,
    "eventId" TEXT,
    "mainInstallations" TEXT NOT NULL DEFAULT '',
    "otherMaterials" TEXT NOT NULL DEFAULT '',
    "reportText" TEXT NOT NULL DEFAULT '',
    "reportFrozen" BOOLEAN NOT NULL DEFAULT false,
    "status" "WorkSheetStatus" NOT NULL DEFAULT 'DRAFT',
    "archivedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkSheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkSheetItem" (
    "id" TEXT NOT NULL,
    "workSheetId" TEXT NOT NULL,
    "materialId" TEXT,
    "variantId" TEXT,
    "categoryNameSnapshot" TEXT NOT NULL,
    "materialNameSnapshot" TEXT NOT NULL,
    "reportLabelSnapshot" TEXT NOT NULL,
    "variantNameSnapshot" TEXT,
    "variantReportSnapshot" TEXT,
    "unitSnapshot" "MaterialUnit" NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "detailValue" DOUBLE PRECISION,
    "supplier" "MaterialSupplier" NOT NULL DEFAULT 'INTERNAL',
    "installed" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkSheetItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkSheet_workDate_idx" ON "WorkSheet"("workDate");

-- CreateIndex
CREATE INDEX "WorkSheet_archivedAt_createdAt_idx" ON "WorkSheet"("archivedAt", "createdAt");

-- CreateIndex
CREATE INDEX "WorkSheetItem_workSheetId_position_idx" ON "WorkSheetItem"("workSheetId", "position");

-- CreateIndex
CREATE INDEX "WorkSheetItem_materialId_idx" ON "WorkSheetItem"("materialId");

-- AddForeignKey
ALTER TABLE "WorkSheet" ADD CONSTRAINT "WorkSheet_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkSheetItem" ADD CONSTRAINT "WorkSheetItem_workSheetId_fkey" FOREIGN KEY ("workSheetId") REFERENCES "WorkSheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkSheetItem" ADD CONSTRAINT "WorkSheetItem_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkSheetItem" ADD CONSTRAINT "WorkSheetItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "MaterialVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
