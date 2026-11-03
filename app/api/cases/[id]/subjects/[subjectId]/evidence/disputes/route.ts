import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { Prisma } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { checkRateLimit } from '@/lib/rate-limit'

interface RouteParams {
  params: Promise<{ id: string; subjectId: string }>
}

function serializeValue(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
  if (value === undefined) return undefined
  if (value === null) return Prisma.JsonNull
  return value as Prisma.InputJsonValue
}

export async function GET(_request: Request, { params }: RouteParams) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = (session.user as { id: string }).id
  const { id: caseId, subjectId } = await params

  const subject = await prisma.subject.findFirst({
    where: {
      id: subjectId,
      caseId,
      case: { userId },
    },
    include: {
      enrichmentResults: {
        include: {
          evidenceFacts: {
            include: {
              disputes: {
                where: { userId },
                orderBy: { createdAt: 'desc' },
              },
            },
            orderBy: { retrievedAt: 'desc' },
          },
        },
        orderBy: { timestamp: 'desc' },
      },
    },
  })

  if (!subject) {
    return NextResponse.json({ error: 'Subject not found' }, { status: 404 })
  }

  const facts = subject.enrichmentResults.flatMap(result =>
    result.evidenceFacts.map(fact => ({
      id: fact.id,
      field: fact.field,
      value: fact.value,
      sourceName: fact.sourceName,
      sourceType: fact.sourceType,
      sourceUrl: fact.sourceUrl,
      retrievedAt: fact.retrievedAt,
      observedAt: fact.observedAt,
      confidenceScore: fact.confidenceScore,
      corroborationCount: fact.corroborationCount,
      conflictCount: fact.conflictCount,
      disputes: fact.disputes.map(dispute => ({
        id: dispute.id,
        status: dispute.status,
        reason: dispute.reason,
        requestedValue: dispute.requestedValue,
        resolutionNote: dispute.resolutionNote,
        resolvedAt: dispute.resolvedAt,
        createdAt: dispute.createdAt,
        updatedAt: dispute.updatedAt,
      })),
    }))
  )

  return NextResponse.json({
    subject: {
      id: subject.id,
      fullName: subject.fullName,
    },
    facts,
    openDisputeCount: facts.reduce(
      (sum, fact) => sum + fact.disputes.filter(dispute => dispute.status === 'open').length,
      0
    ),
  })
}

export async function POST(request: Request, { params }: RouteParams) {
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

  let body: { evidenceFactId?: unknown; reason?: unknown; requestedValue?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const evidenceFactId = typeof body.evidenceFactId === 'string' ? body.evidenceFactId.trim() : ''
  const reason = typeof body.reason === 'string' ? body.reason.trim() : ''

  if (!evidenceFactId) {
    return NextResponse.json({ error: 'Evidence fact is required' }, { status: 400 })
  }
  if (reason.length < 5 || reason.length > 2000) {
    return NextResponse.json(
      { error: 'Reason must be between 5 and 2000 characters' },
      { status: 400 }
    )
  }

  const fact = await prisma.evidenceFact.findFirst({
    where: {
      id: evidenceFactId,
      enrichmentResult: {
        subject: {
          id: subjectId,
          caseId,
          case: { userId },
        },
      },
    },
    include: {
      disputes: {
        where: { userId, status: 'open' },
        select: { id: true },
      },
    },
  })

  if (!fact) {
    return NextResponse.json({ error: 'Evidence fact not found' }, { status: 404 })
  }

  if (fact.disputes.length > 0) {
    return NextResponse.json(
      { error: 'An open dispute already exists for this evidence fact' },
      { status: 409 }
    )
  }

  const dispute = await prisma.evidenceDispute.create({
    data: {
      evidenceFactId,
      userId,
      reason,
      requestedValue: serializeValue(body.requestedValue),
    },
  })

  await createAuditLog(userId, 'SUBMIT_EVIDENCE_DISPUTE', {
    caseId,
    subjectId,
    evidenceFactId,
    disputeId: dispute.id,
    sourceName: fact.sourceName,
    field: fact.field,
  }, subjectId)

  return NextResponse.json({
    dispute: {
      id: dispute.id,
      status: dispute.status,
      reason: dispute.reason,
      requestedValue: dispute.requestedValue,
      createdAt: dispute.createdAt,
    },
  }, { status: 201 })
}
