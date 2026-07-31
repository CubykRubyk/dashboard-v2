ALTER TABLE "WorkSheet" ADD COLUMN "legacyId" TEXT;
CREATE UNIQUE INDEX "WorkSheet_legacyId_key" ON "WorkSheet"("legacyId");
