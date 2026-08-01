CREATE TABLE "DocumentIssuer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "defaultResponsible" TEXT NOT NULL DEFAULT '',
    "refrigerantAttestationNumber" TEXT NOT NULL DEFAULT '',
    "logoData" TEXT NOT NULL DEFAULT '',
    "stampData" TEXT NOT NULL DEFAULT '',
    "signatureData" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentIssuer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DocumentIssuer_name_key" ON "DocumentIssuer"("name");
CREATE INDEX "DocumentIssuer_active_name_idx" ON "DocumentIssuer"("active", "name");
