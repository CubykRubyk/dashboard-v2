
-- CreateTable
CREATE TABLE "InterventionMaterial" (
    "id" TEXT NOT NULL,
    "interventionId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterventionMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InterventionMaterial_equipmentId_idx" ON "InterventionMaterial"("equipmentId");

-- CreateIndex
CREATE UNIQUE INDEX "InterventionMaterial_interventionId_equipmentId_key" ON "InterventionMaterial"("interventionId", "equipmentId");

-- AddForeignKey
ALTER TABLE "InterventionMaterial" ADD CONSTRAINT "InterventionMaterial_interventionId_fkey" FOREIGN KEY ("interventionId") REFERENCES "InterventionPlanning"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterventionMaterial" ADD CONSTRAINT "InterventionMaterial_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

