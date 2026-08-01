ALTER TABLE "GeneratedDocument" ADD COLUMN "systemCombinationId" TEXT;
ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_systemCombinationId_fkey" FOREIGN KEY ("systemCombinationId") REFERENCES "SystemCombination"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "GeneratedDocument_systemCombinationId_idx" ON "GeneratedDocument"("systemCombinationId");
