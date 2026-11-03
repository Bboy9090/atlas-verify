import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { Prisma } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { checkRateLimit } from '@/lib/rate-limit'
import {
  buildEvidenceSnapshot,
  diffEvidenceManifests,
  type EvidenceManifestEntry,
} from '@/lib/monitoring'

interface RouteParams {
  params: Promise<{ monitorId: string }>
}

function parseManifest(value: Prisma.JsonValue): EvidenceManifestEntry[] {
  if (!Array.isArray(value)) return []

  return value
    .map(item => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null
      const record = item as Record<string, unknown>
      if (
        typeof record.key !== 'string' ||
        typeof record.field !== 'string' ||
        typeof record.sourceName !== 'string' ||
        typeof record.valueLabel !== 'string'
      ) {
        return null
      }

      return {
        key: record.key,
        field: record.field,
        sourceName: record.sourceName,
        valueLabel: record.valueLabel,
      }
    })
    .filter((item): item is EvidenceManifestEntry => Boolean(item))
}

export async function POST(_request: Request, { params }: RouteParams) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = (session.user as { id: string }).id
  const rateLimit = checkRateLimit(userId)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', resetIn: rateLimit.resetIn },
      { status: 429 }
    )
  }

  const { monitorId } = await params

  const monitor = await prisma.subjectMonitor.findFirst({
    where: {
      id: monitorId,
      userId,
      subject: {
        case: { userId },
      },
    },
    include: {
      subject: {
        include: {
          case: {
            select: { id: true, title: true },
          },
          enrichmentResults: {
            include: {
              evidenceFacts: {
                orderBy: { retrievedAt: 'desc' },
              },
            },
          },
        },
      },
    },
  })

  if (!monitor) {
    return NextResponse.json({ error: 'Monitor not found' }, { status: 404 })
  }

  if (!monitor.enabled) {
    return NextResponse.json({ error: 'Monitor is disabled' }, { status: 409 })
  }

  const facts = monitor.subject.enrichmentResults.flatMap(result =>
    result.evidenceFacts.map(fact => ({
      field: fact.field,
      value: fact.value,
      sourceName: fact.sourceName,
      normalizedValue: fact.normalizedValue,
      rawRecordHash: fact.rawRecordHash,
      observedAt: fact.observedAt,
    }))
  )

  const snapshot = buildEvidenceSnapshot(facts)
  const previousManifest = parseManifest(monitor.baselineManifest)
  const changed = snapshot.hash !== monitor.baselineHash
  const changeSummary = changed
    ? diffEvidenceManifests(previousManifest, snapshot.manifest)
    : { added: [], removed: [], addedCount: 0, removedCount: 0 }

  const now = new Date()

  const [check, updatedMonitor] = await prisma.$transaction([
    prisma.monitorCheck.create({
      data: {
        monitorId: monitor.id,
        snapshotHash: snapshot.hash,
        factCount: snapshot.factCount,
        sourceCount: snapshot.sourceCount,
        changed,
        changeSummary: changeSummary as unknown as Prisma.InputJsonValue,
        checkedAt: now,
      },
    }),
    prisma.subjectMonitor.update({
      where: { id: monitor.id },
      data: {
        baselineHash: snapshot.hash,
        baselineFactCount: snapshot.factCount,
        baselineSourceCount: snapshot.sourceCount,
        baselineManifest: snapshot.manifest as unknown as Prisma.InputJsonValue,
        lastCheckedAt: now,
        lastChangedAt: changed ? now : monitor.lastChangedAt,
        lastChangeSummary: changed
          ? changeSummary as unknown as Prisma.InputJsonValue
          : monitor.lastChangeSummary === null
            ? Prisma.JsonNull
            : monitor.lastChangeSummary as unknown as Prisma.InputJsonValue,
      },
    }),
  ])

  await createAuditLog(userId, 'CHECK_MONITOR', {
    monitorId: monitor.id,
    caseId: monitor.subject.case.id,
    subjectId: monitor.subject.id,
    changed,
    factCount: snapshot.factCount,
    sourceCount: snapshot.sourceCount,
    addedCount: changeSummary.addedCount,
    removedCount: changeSummary.removedCount,
    snapshotHash: snapshot.hash,
    automaticProviderMonitoring: false,
  }, monitor.subject.id)

  return NextResponse.json({
    monitor: updatedMonitor,
    check,
    changed,
    changeSummary,
    snapshot,
    message: changed
      ? 'Stored evidence changed since the previous checkpoint.'
      : 'No stored evidence changes detected since the previous checkpoint.',
  }, {
    headers: { 'Cache-Control': 'no-store, private' },
  })
}
