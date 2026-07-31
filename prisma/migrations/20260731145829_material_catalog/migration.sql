-- CreateEnum
CREATE TYPE "MaterialInputType" AS ENUM ('CHECKBOX', 'QUANTITY', 'SELECT', 'DETAIL');

-- CreateEnum
CREATE TYPE "MaterialUnit" AS ENUM ('NONE', 'PIECE', 'METER', 'BAG', 'RADIATOR');

-- CreateTable
CREATE TABLE "MaterialCategory" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "reportLabel" TEXT NOT NULL,
    "inputType" "MaterialInputType" NOT NULL DEFAULT 'CHECKBOX',
    "unit" "MaterialUnit" NOT NULL DEFAULT 'PIECE',
    "defaultQuantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "detailLabel" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "allowSupplier" BOOLEAN NOT NULL DEFAULT true,
    "allowNotInstalled" BOOLEAN NOT NULL DEFAULT true,
    "categoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialVariant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "reportLabel" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "materialId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialVariant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MaterialCategory_key_key" ON "MaterialCategory"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Material_key_key" ON "Material"("key");

-- CreateIndex
CREATE INDEX "Material_categoryId_position_idx" ON "Material"("categoryId", "position");

-- CreateIndex
CREATE INDEX "MaterialVariant_materialId_position_idx" ON "MaterialVariant"("materialId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialVariant_materialId_name_key" ON "MaterialVariant"("materialId", "name");

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MaterialCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialVariant" ADD CONSTRAINT "MaterialVariant_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;
