ALTER TABLE "TechnicalDocument"
ADD COLUMN "checksumSha256" TEXT;

ALTER TABLE "TechnicalDocument"
ADD CONSTRAINT "TechnicalDocument_checksumSha256_check"
CHECK (
  "checksumSha256" IS NULL
  OR "checksumSha256" ~ '^[0-9a-f]{64}$'
);

CREATE UNIQUE INDEX "TechnicalDocument_checksumSha256_key"
ON "TechnicalDocument"("checksumSha256");
