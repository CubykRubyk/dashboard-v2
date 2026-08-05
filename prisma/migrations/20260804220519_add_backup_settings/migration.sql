-- AlterTable
ALTER TABLE "AppSettings" ADD COLUMN     "backupIntervalHours" INTEGER,
ADD COLUMN     "backupLastError" TEXT,
ADD COLUMN     "backupLastRunAt" TIMESTAMP(3);
