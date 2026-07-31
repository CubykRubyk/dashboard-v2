CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6c757d',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkSheetTag" (
    "workSheetId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    CONSTRAINT "WorkSheetTag_pkey" PRIMARY KEY ("workSheetId", "tagId")
);

CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");
CREATE INDEX "Tag_active_position_idx" ON "Tag"("active", "position");
CREATE INDEX "WorkSheetTag_tagId_idx" ON "WorkSheetTag"("tagId");

ALTER TABLE "WorkSheetTag"
ADD CONSTRAINT "WorkSheetTag_workSheetId_fkey"
FOREIGN KEY ("workSheetId") REFERENCES "WorkSheet"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkSheetTag"
ADD CONSTRAINT "WorkSheetTag_tagId_fkey"
FOREIGN KEY ("tagId") REFERENCES "Tag"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
