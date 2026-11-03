CREATE TABLE "SubjectMonitor" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "baselineHash" TEXT NOT NULL,
    "baselineFactCount" INTEGER NOT NULL DEFAULT 0,
    "baselineSourceCount" INTEGER NOT NULL DEFAULT 0,
    "lastCheckedAt" TIMESTAMP(3),
    "lastChangedAt" TIMESTAMP(3),
    "lastChangeSummary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubjectMonitor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MonitorCheck" (
    "id" TEXT NOT NULL,
    "monitorId" TEXT NOT NULL,
    "snapshotHash" TEXT NOT NULL,
    "factCount" INTEGER NOT NULL,
    "sourceCount" INTEGER NOT NULL,
    "changed" BOOLEAN NOT NULL DEFAULT false,
    "changeSummary" JSONB,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonitorCheck_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SubjectMonitor_userId_subjectId_key" ON "SubjectMonitor"("userId", "subjectId");
CREATE INDEX "SubjectMonitor_userId_idx" ON "SubjectMonitor"("userId");
CREATE INDEX "SubjectMonitor_subjectId_idx" ON "SubjectMonitor"("subjectId");
CREATE INDEX "SubjectMonitor_enabled_idx" ON "SubjectMonitor"("enabled");

CREATE INDEX "MonitorCheck_monitorId_idx" ON "MonitorCheck"("monitorId");
CREATE INDEX "MonitorCheck_checkedAt_idx" ON "MonitorCheck"("checkedAt");
CREATE INDEX "MonitorCheck_changed_idx" ON "MonitorCheck"("changed");

ALTER TABLE "SubjectMonitor"
ADD CONSTRAINT "SubjectMonitor_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SubjectMonitor"
ADD CONSTRAINT "SubjectMonitor_subjectId_fkey"
FOREIGN KEY ("subjectId") REFERENCES "Subject"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MonitorCheck"
ADD CONSTRAINT "MonitorCheck_monitorId_fkey"
FOREIGN KEY ("monitorId") REFERENCES "SubjectMonitor"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
