/*
  Warnings:

  - You are about to drop the column `workSheetId` on the `GeneratedDocument` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "GeneratedDocument" DROP CONSTRAINT "GeneratedDocument_workSheetId_fkey";

-- DropIndex
DROP INDEX "GeneratedDocument_workSheetId_idx";

-- AlterTable
ALTER TABLE "GeneratedDocument" DROP COLUMN "workSheetId",
ADD COLUMN     "eventId" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE INDEX "GeneratedDocument_eventId_idx" ON "GeneratedDocument"("eventId");
