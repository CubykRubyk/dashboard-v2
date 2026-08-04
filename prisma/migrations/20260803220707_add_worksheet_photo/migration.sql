-- CreateTable
CREATE TABLE "WorkSheetPhoto" (
    "id" TEXT NOT NULL,
    "workSheetId" TEXT NOT NULL,
    "storageName" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksumSha256" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "position" INTEGER NOT NULL DEFAULT 0,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkSheetPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkSheetPhoto_storageName_key" ON "WorkSheetPhoto"("storageName");

-- CreateIndex
CREATE INDEX "WorkSheetPhoto_workSheetId_position_idx" ON "WorkSheetPhoto"("workSheetId", "position");

-- AddForeignKey
ALTER TABLE "WorkSheetPhoto" ADD CONSTRAINT "WorkSheetPhoto_workSheetId_fkey" FOREIGN KEY ("workSheetId") REFERENCES "WorkSheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkSheetPhoto" ADD CONSTRAINT "WorkSheetPhoto_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
