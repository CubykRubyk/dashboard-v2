-- AlterTable
ALTER TABLE "GeneratedDocument" ADD COLUMN     "clientLabel" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE INDEX "GeneratedDocument_clientLabel_idx" ON "GeneratedDocument"("clientLabel");
