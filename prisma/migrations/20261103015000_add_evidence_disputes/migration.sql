CREATE TABLE "EvidenceDispute" (
    "id" TEXT NOT NULL,
    "evidenceFactId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "reason" TEXT NOT NULL,
    "requestedValue" JSONB,
    "resolutionNote" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvidenceDispute_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EvidenceDispute_evidenceFactId_idx" ON "EvidenceDispute"("evidenceFactId");
CREATE INDEX "EvidenceDispute_userId_idx" ON "EvidenceDispute"("userId");
CREATE INDEX "EvidenceDispute_status_idx" ON "EvidenceDispute"("status");
CREATE INDEX "EvidenceDispute_createdAt_idx" ON "EvidenceDispute"("createdAt");

ALTER TABLE "EvidenceDispute"
ADD CONSTRAINT "EvidenceDispute_evidenceFactId_fkey"
FOREIGN KEY ("evidenceFactId") REFERENCES "EvidenceFact"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EvidenceDispute"
ADD CONSTRAINT "EvidenceDispute_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
