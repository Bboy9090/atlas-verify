import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { checkRateLimit } from '@/lib/rate-limit'

interface RouteParams {
  params: Promise<{ id: string; subjectId: string; disputeId: string }>
}

export async function PATCH(request: Request, { params }: RouteParams) {
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

  const { id: caseId, subjectId, disputeId } = await params

  let body: { status?: unknown; resolutionNote?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const status = typeof body.status === 'string' ? body.status.trim() : ''
  const resolutionNote = typeof body.resolutionNote === 'string'
    ? body.resolutionNote.trim()
    : ''

  if (!['resolved', 'rejected'].includes(status)) {
    return NextResponse.json(
      { error: 'Status must be resolved or rejected' },
      { status: 400 }
    )
  }

  if (resolutionNote.length < 3 || resolutionNote.length > 2000) {
    return NextResponse.json(
      { error: 'Resolution note must be between 3 and 2000 characters' },
      { status: 400 }
    )
  }

  const dispute = await prisma.evidenceDispute.findFirst({
    where: {
      id: disputeId,
      userId,
      evidenceFact: {
        enrichmentResult: {
          subject: {
            id: subjectId,
            caseId,
            case: { userId },
          },
        },
      },
    },
    include: {
      evidenceFact: {
        select: {
          id: true,
          field: true,
          sourceName: true,
        },
      },
    },
  })

  if (!dispute) {
    return NextResponse.json({ error: 'Dispute not found' }, { status: 404 })
  }

  if (dispute.status !== 'open') {
    return NextResponse.json(
      { error: 'Only open disputes can be resolved' },
      { status: 409 }
    )
  }

  const updated = await prisma.evidenceDispute.update({
    where: { id: dispute.id },
    data: {
      status,
      resolutionNote,
      resolvedAt: new Date(),
    },
  })

  await createAuditLog(userId, 'RESOLVE_EVIDENCE_DISPUTE', {
    caseId,
    subjectId,
    evidenceFactId: dispute.evidenceFact.id,
    disputeId: dispute.id,
    status,
    sourceName: dispute.evidenceFact.sourceName,
    field: dispute.evidenceFact.field,
  }, subjectId)

  return NextResponse.json({
    dispute: {
      id: updated.id,
      status: updated.status,
      reason: updated.reason,
      requestedValue: updated.requestedValue,
      resolutionNote: updated.resolutionNote,
      resolvedAt: updated.resolvedAt,
      updatedAt: updated.updatedAt,
    },
  })
}
