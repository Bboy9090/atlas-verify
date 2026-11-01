CREATE TABLE "EvidenceFact" (
    "id" TEXT NOT NULL,
    "enrichmentResultId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "retrievedAt" TIMESTAMP(3) NOT NULL,
    "observedAt" TIMESTAMP(3),
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "corroborationCount" INTEGER NOT NULL DEFAULT 0,
    "conflictCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceFact_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EvidenceFact_enrichmentResultId_idx" ON "EvidenceFact"("enrichmentResultId");
CREATE INDEX "EvidenceFact_field_idx" ON "EvidenceFact"("field");
CREATE INDEX "EvidenceFact_sourceName_idx" ON "EvidenceFact"("sourceName");
CREATE INDEX "EvidenceFact_retrievedAt_idx" ON "EvidenceFact"("retrievedAt");

ALTER TABLE "EvidenceFact"
ADD CONSTRAINT "EvidenceFact_enrichmentResultId_fkey"
FOREIGN KEY ("enrichmentResultId") REFERENCES "EnrichmentResult"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
