-- AlterTable: add status column to Case with default 'open'
ALTER TABLE "Case" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'open';

-- CreateIndex
CREATE INDEX "Case_status_idx" ON "Case"("status");
