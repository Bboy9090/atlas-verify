ALTER TABLE "Subject"
ADD COLUMN "username" TEXT;

CREATE INDEX "Subject_username_idx" ON "Subject"("username");

ALTER TABLE "EvidenceFact"
ADD COLUMN "sourceType" TEXT,
ADD COLUMN "sourceLocator" TEXT,
ADD COLUMN "normalizedValue" TEXT,
ADD COLUMN "rawRecordHash" TEXT,
ADD COLUMN "legalBasis" TEXT;

CREATE INDEX "EvidenceFact_sourceType_idx" ON "EvidenceFact"("sourceType");
CREATE INDEX "EvidenceFact_rawRecordHash_idx" ON "EvidenceFact"("rawRecordHash");
