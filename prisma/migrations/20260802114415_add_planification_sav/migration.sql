-- CreateEnum
CREATE TYPE "SavPriority" AS ENUM ('BASSE', 'NORMALE', 'HAUTE', 'URGENTE');

-- CreateEnum
CREATE TYPE "SavStatus" AS ENUM ('OUVERT', 'CLOTURE');

-- CreateEnum
CREATE TYPE "SavHistoryType" AS ENUM ('NOTE', 'STATUS', 'PRIORITY', 'CLOSURE', 'PLANNING');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "teamId" TEXT;

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavTicket" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "equipment" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "priority" "SavPriority" NOT NULL DEFAULT 'NORMALE',
    "status" "SavStatus" NOT NULL DEFAULT 'OUVERT',
    "teamId" TEXT,
    "desiredDate" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "closureReason" TEXT,
    "closureNote" TEXT,
    "planningDate" TIMESTAMP(3),
    "planningStartTime" TEXT,
    "planningEndTime" TEXT,
    "planningNote" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavHistoryEntry" (
    "id" TEXT NOT NULL,
    "savTicketId" TEXT NOT NULL,
    "type" "SavHistoryType" NOT NULL,
    "text" TEXT NOT NULL,
    "detail" TEXT,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavHistoryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Team_name_key" ON "Team"("name");

-- CreateIndex
CREATE INDEX "Team_active_name_idx" ON "Team"("active", "name");

-- CreateIndex
CREATE UNIQUE INDEX "SavTicket_reference_key" ON "SavTicket"("reference");

-- CreateIndex
CREATE INDEX "SavTicket_status_priority_idx" ON "SavTicket"("status", "priority");

-- CreateIndex
CREATE INDEX "SavTicket_teamId_idx" ON "SavTicket"("teamId");

-- CreateIndex
CREATE INDEX "SavHistoryEntry_savTicketId_createdAt_idx" ON "SavHistoryEntry"("savTicketId", "createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavTicket" ADD CONSTRAINT "SavTicket_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavTicket" ADD CONSTRAINT "SavTicket_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavHistoryEntry" ADD CONSTRAINT "SavHistoryEntry_savTicketId_fkey" FOREIGN KEY ("savTicketId") REFERENCES "SavTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavHistoryEntry" ADD CONSTRAINT "SavHistoryEntry_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
