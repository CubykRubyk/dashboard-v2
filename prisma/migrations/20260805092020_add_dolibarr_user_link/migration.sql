
-- AlterTable
ALTER TABLE "InterventionPlanning" ADD COLUMN     "dolibarrLastError" TEXT,
ADD COLUMN     "dolibarrOwnerId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "dolibarrUserId" TEXT;

-- CreateIndex
CREATE INDEX "InterventionPlanning_dolibarrOwnerId_idx" ON "InterventionPlanning"("dolibarrOwnerId");

-- CreateIndex
CREATE UNIQUE INDEX "User_dolibarrUserId_key" ON "User"("dolibarrUserId");

