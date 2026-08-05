-- CreateEnum
CREATE TYPE "SavOrigin" AS ENUM ('INTERNAL', 'CLIENT_FORM');

-- DropForeignKey
ALTER TABLE "SavTicket" DROP CONSTRAINT "SavTicket_createdById_fkey";

-- AlterTable
ALTER TABLE "SavTicket" ADD COLUMN     "contactEmail" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "origin" "SavOrigin" NOT NULL DEFAULT 'INTERNAL',
ALTER COLUMN "createdById" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "entityType" TEXT,
    "entityId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavAttachment" (
    "id" TEXT NOT NULL,
    "savTicketId" TEXT NOT NULL,
    "storageName" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksumSha256" TEXT NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SavAttachment_storageName_key" ON "SavAttachment"("storageName");

-- CreateIndex
CREATE INDEX "SavAttachment_savTicketId_createdAt_idx" ON "SavAttachment"("savTicketId", "createdAt");

-- AddForeignKey
ALTER TABLE "SavTicket" ADD CONSTRAINT "SavTicket_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavAttachment" ADD CONSTRAINT "SavAttachment_savTicketId_fkey" FOREIGN KEY ("savTicketId") REFERENCES "SavTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavAttachment" ADD CONSTRAINT "SavAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
