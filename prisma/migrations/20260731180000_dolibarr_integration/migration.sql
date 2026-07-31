ALTER TABLE "WorkSheet"
ADD COLUMN "dolibarrSentAt" TIMESTAMP(3),
ADD COLUMN "dolibarrLastError" TEXT;

CREATE TABLE "AppSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "dolibarrUrl" TEXT NOT NULL DEFAULT '',
    "dolibarrApiKeyEncrypted" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);
