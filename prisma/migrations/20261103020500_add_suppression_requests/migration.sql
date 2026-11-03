CREATE TABLE "SuppressionRequest" (
    "id" TEXT NOT NULL,
    "requestTokenHash" TEXT NOT NULL,
    "identifierType" TEXT NOT NULL,
    "identifierHash" TEXT NOT NULL,
    "identifierHint" TEXT,
    "contactEmailHash" TEXT,
    "contactHint" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "verificationNote" TEXT,
    "resolutionNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SuppressionRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SuppressionRequest_requestTokenHash_key" ON "SuppressionRequest"("requestTokenHash");
CREATE INDEX "SuppressionRequest_identifierType_identifierHash_idx" ON "SuppressionRequest"("identifierType", "identifierHash");
CREATE INDEX "SuppressionRequest_status_idx" ON "SuppressionRequest"("status");
CREATE INDEX "SuppressionRequest_createdAt_idx" ON "SuppressionRequest"("createdAt");

ALTER TABLE "SuppressionRequest"
ADD CONSTRAINT "SuppressionRequest_reviewedById_fkey"
FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
