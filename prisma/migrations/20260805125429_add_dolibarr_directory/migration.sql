
-- AlterTable
ALTER TABLE "AppSettings" ADD COLUMN     "dolibarrDirectoryError" TEXT,
ADD COLUMN     "dolibarrDirectorySyncedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "DolibarrUser" (
    "id" TEXT NOT NULL,
    "dolibarrId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "login" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "job" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL DEFAULT '',
    "isEmployee" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "syncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DolibarrUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DolibarrCompany" (
    "id" TEXT NOT NULL,
    "dolibarrId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL DEFAULT '',
    "zip" TEXT NOT NULL DEFAULT '',
    "town" TEXT NOT NULL DEFAULT '',
    "clientCode" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "syncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DolibarrCompany_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DolibarrUser_dolibarrId_key" ON "DolibarrUser"("dolibarrId");

-- CreateIndex
CREATE INDEX "DolibarrUser_favorite_name_idx" ON "DolibarrUser"("favorite", "name");

-- CreateIndex
CREATE INDEX "DolibarrUser_active_name_idx" ON "DolibarrUser"("active", "name");

-- CreateIndex
CREATE UNIQUE INDEX "DolibarrCompany_dolibarrId_key" ON "DolibarrCompany"("dolibarrId");

-- CreateIndex
CREATE INDEX "DolibarrCompany_favorite_name_idx" ON "DolibarrCompany"("favorite", "name");

-- CreateIndex
CREATE INDEX "DolibarrCompany_active_name_idx" ON "DolibarrCompany"("active", "name");

