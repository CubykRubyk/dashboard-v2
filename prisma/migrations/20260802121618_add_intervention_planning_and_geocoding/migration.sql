-- AlterTable
ALTER TABLE "AppSettings" ADD COLUMN     "dolibarrEventsSyncedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "SavTicket" ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "InterventionPlanning" (
    "id" TEXT NOT NULL,
    "dolibarrEventId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "team" TEXT NOT NULL DEFAULT '',
    "status" "SavStatus" NOT NULL DEFAULT 'OUVERT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterventionPlanning_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InterventionPlanning_dolibarrEventId_key" ON "InterventionPlanning"("dolibarrEventId");

-- CreateIndex
CREATE INDEX "InterventionPlanning_startAt_idx" ON "InterventionPlanning"("startAt");
