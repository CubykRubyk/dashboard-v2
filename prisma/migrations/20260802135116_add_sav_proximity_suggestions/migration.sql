-- AlterTable
ALTER TABLE "AppSettings" ADD COLUMN     "proximitySuggestionsSyncedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SavProximitySuggestion" (
    "id" TEXT NOT NULL,
    "savTicketId" TEXT NOT NULL,
    "interventionId" TEXT NOT NULL,
    "distanceKm" DOUBLE PRECISION NOT NULL,
    "travelMinutes" INTEGER NOT NULL,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "dismissedAt" TIMESTAMP(3),
    "dismissedById" TEXT,
    "savAddressSnapshot" TEXT NOT NULL,
    "interventionStartAtSnapshot" TIMESTAMP(3),
    "interventionTeamSnapshot" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavProximitySuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavProximitySuggestion_savTicketId_idx" ON "SavProximitySuggestion"("savTicketId");

-- CreateIndex
CREATE INDEX "SavProximitySuggestion_interventionId_idx" ON "SavProximitySuggestion"("interventionId");

-- CreateIndex
CREATE UNIQUE INDEX "SavProximitySuggestion_savTicketId_interventionId_key" ON "SavProximitySuggestion"("savTicketId", "interventionId");

-- AddForeignKey
ALTER TABLE "SavProximitySuggestion" ADD CONSTRAINT "SavProximitySuggestion_savTicketId_fkey" FOREIGN KEY ("savTicketId") REFERENCES "SavTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavProximitySuggestion" ADD CONSTRAINT "SavProximitySuggestion_interventionId_fkey" FOREIGN KEY ("interventionId") REFERENCES "InterventionPlanning"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavProximitySuggestion" ADD CONSTRAINT "SavProximitySuggestion_dismissedById_fkey" FOREIGN KEY ("dismissedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
