import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { Prisma } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { checkRateLimit } from '@/lib/rate-limit'
import { buildEvidenceSnapshot } from '@/lib/monitoring'

interface RouteParams {
  params: Promise<{ id: string; subjectId: string }>
}

async function loadOwnedSubject(userId: string, caseId: string, subjectId: string) {
  return prisma.subject.findFirst({
    where: {
      id: subjectId,
      caseId,
      case: { userId },
    },
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
      monitors: {
        where: { userId },
        include: {
          checks: {
            orderBy: { checkedAt: 'desc' },
            take: 10,
          },
        },
        take: 1,
      },
    },
  })
}

function factsForSnapshot(subject: NonNullable<Awaited<ReturnType<typeof loadOwnedSubject>>>) {
  return subject.enrichmentResults.flatMap(result =>
    result.evidenceFacts.map(fact => ({
      field: fact.field,
      value: fact.value,
      sourceName: fact.sourceName,
      normalizedValue: fact.normalizedValue,
      rawRecordHash: fact.rawRecordHash,
      observedAt: fact.observedAt,
    }))
  )
}

export async function GET(_request: Request, { params }: RouteParams) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = (session.user as { id: string }).id
  const { id: caseId, subjectId } = await params
  const subject = await loadOwnedSubject(userId, caseId, subjectId)

  if (!subject) {
    return NextResponse.json({ error: 'Subject not found' }, { status: 404 })
  }

  const monitor = subject.monitors[0] ?? null

  return NextResponse.json({
    subject: {
      id: subject.id,
      fullName: subject.fullName,
      case: subject.case,
    },
    monitor,
    currentSnapshot: buildEvidenceSnapshot(factsForSnapshot(subject)),
    automaticProviderMonitoring: false,
  }, {
    headers: { 'Cache-Control': 'no-store, private' },
  })
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

  const { id: caseId, subjectId } = await params
  const subject = await loadOwnedSubject(userId, caseId, subjectId)

  if (!subject) {
    return NextResponse.json({ error: 'Subject not found' }, { status: 404 })
  }

  const snapshot = buildEvidenceSnapshot(factsForSnapshot(subject))
  const existing = subject.monitors[0] ?? null
  const now = new Date()

  const monitor = await prisma.subjectMonitor.upsert({
    where: {
      userId_subjectId: { userId, subjectId },
    },
    update: {
      enabled: true,
      baselineHash: snapshot.hash,
      baselineFactCount: snapshot.factCount,
      baselineSourceCount: snapshot.sourceCount,
      baselineManifest: snapshot.manifest as Prisma.InputJsonValue,
      lastCheckedAt: now,
      lastChangeSummary: Prisma.JsonNull,
    },
    create: {
      userId,
      subjectId,
      enabled: true,
      baselineHash: snapshot.hash,
      baselineFactCount: snapshot.factCount,
      baselineSourceCount: snapshot.sourceCount,
      baselineManifest: snapshot.manifest as Prisma.InputJsonValue,
      lastCheckedAt: now,
    },
  })

  await prisma.monitorCheck.create({
    data: {
      monitorId: monitor.id,
      snapshotHash: snapshot.hash,
      factCount: snapshot.factCount,
      sourceCount: snapshot.sourceCount,
      changed: false,
      changeSummary: {
        kind: existing ? 'baseline_reset' : 'baseline_created',
        addedCount: 0,
        removedCount: 0,
      } as Prisma.InputJsonValue,
      checkedAt: now,
    },
  })

  await createAuditLog(userId, 'CREATE_MONITOR', {
    caseId,
    subjectId,
    monitorId: monitor.id,
    action: existing ? 'baseline_reset' : 'created',
    factCount: snapshot.factCount,
    sourceCount: snapshot.sourceCount,
    snapshotHash: snapshot.hash,
    automaticProviderMonitoring: false,
  }, subjectId)

  return NextResponse.json({
    monitor,
    snapshot,
    message: existing
      ? 'Monitoring baseline reset to the current stored evidence state.'
      : 'Subject monitoring started from the current stored evidence state.',
  }, { status: existing ? 200 : 201 })
}

export async function DELETE(_request: Request, { params }: RouteParams) {
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

  const { id: caseId, subjectId } = await params

  const monitor = await prisma.subjectMonitor.findFirst({
    where: {
      userId,
      subjectId,
      subject: {
        caseId,
        case: { userId },
      },
    },
  })

  if (!monitor) {
    return NextResponse.json({ error: 'Monitor not found' }, { status: 404 })
  }

  await prisma.subjectMonitor.delete({ where: { id: monitor.id } })

  await createAuditLog(userId, 'DELETE_MONITOR', {
    caseId,
    subjectId,
    monitorId: monitor.id,
  }, subjectId)

  return NextResponse.json({ success: true })
}
