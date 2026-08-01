CREATE TABLE "DocumentTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "storageName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'application/pdf',
    "sizeBytes" INTEGER NOT NULL,
    "checksumSha256" TEXT NOT NULL,
    "fields" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX "DocumentTemplate_storageName_key" ON "DocumentTemplate"("storageName");
CREATE UNIQUE INDEX "DocumentTemplate_checksumSha256_key" ON "DocumentTemplate"("checksumSha256");
CREATE INDEX "DocumentTemplate_active_name_idx" ON "DocumentTemplate"("active", "name");

CREATE TABLE "GeneratedDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "issuerId" TEXT,
    "title" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "storageName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'application/pdf',
    "sizeBytes" INTEGER NOT NULL,
    "checksumSha256" TEXT NOT NULL,
    "dolibarrEventId" TEXT NOT NULL,
    "dateDocument" TIMESTAMP(3),
    "clientName" TEXT NOT NULL DEFAULT '',
    "siteAddress" TEXT NOT NULL DEFAULT '',
    "responsible" TEXT NOT NULL DEFAULT '',
    "manualFields" JSONB NOT NULL,
    "sourceSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GeneratedDocument_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "DocumentTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "GeneratedDocument_issuerId_fkey" FOREIGN KEY ("issuerId") REFERENCES "DocumentIssuer"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "GeneratedDocument_storageName_key" ON "GeneratedDocument"("storageName");
CREATE UNIQUE INDEX "GeneratedDocument_checksumSha256_key" ON "GeneratedDocument"("checksumSha256");
CREATE INDEX "GeneratedDocument_dolibarrEventId_idx" ON "GeneratedDocument"("dolibarrEventId");
CREATE INDEX "GeneratedDocument_issuerId_createdAt_idx" ON "GeneratedDocument"("issuerId", "createdAt");
