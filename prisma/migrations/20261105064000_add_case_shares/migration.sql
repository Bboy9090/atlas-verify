CREATE TABLE "CaseShare" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CaseShare_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CaseShare_tokenHash_key" ON "CaseShare"("tokenHash");
CREATE INDEX "CaseShare_caseId_idx" ON "CaseShare"("caseId");
CREATE INDEX "CaseShare_ownerId_idx" ON "CaseShare"("ownerId");
CREATE INDEX "CaseShare_expiresAt_idx" ON "CaseShare"("expiresAt");

ALTER TABLE "CaseShare"
  ADD CONSTRAINT "CaseShare_caseId_fkey"
  FOREIGN KEY ("caseId") REFERENCES "Case"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CaseShare"
  ADD CONSTRAINT "CaseShare_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
