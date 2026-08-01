ALTER TABLE "DocumentIssuer"
ADD COLUMN "leakDetectorId" TEXT NOT NULL DEFAULT '',
ADD COLUMN "leakDetectorInspectionDate" TIMESTAMP(3);
