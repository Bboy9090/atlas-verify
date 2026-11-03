import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { checkRateLimit } from '@/lib/rate-limit'
import { isPrivacyReviewer } from '@/lib/privacy-review'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = session.user as { email?: string | null }
  if (!isPrivacyReviewer(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const requests = await prisma.suppressionRequest.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      id: true,
      identifierType: true,
      contactEmail: true,
      status: true,
      verificationNote: true,
      resolutionNote: true,
      reviewedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return NextResponse.json({ requests })
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = session.user as { id: string; email?: string | null }
  if (!isPrivacyReviewer(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const userId = user.id
  const rateLimit = checkRateLimit(userId)
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded', resetIn: rateLimit.resetIn }, { status: 429 })
  }

  let body: { id?: unknown; status?: unknown; verificationNote?: unknown; resolutionNote?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const id = typeof body.id === 'string' ? body.id.trim() : ''
  const status = typeof body.status === 'string' ? body.status.trim() : ''
  const verificationNote = typeof body.verificationNote === 'string' ? body.verificationNote.trim() : ''
  const resolutionNote = typeof body.resolutionNote === 'string' ? body.resolutionNote.trim() : ''

  if (!id) return NextResponse.json({ error: 'Request id is required' }, { status: 400 })
  if (!['approved', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'Status must be approved or rejected' }, { status: 400 })
  }
  if (verificationNote.length < 3 || verificationNote.length > 2000) {
    return NextResponse.json({ error: 'Verification note must be between 3 and 2000 characters' }, { status: 400 })
  }
  if (resolutionNote.length < 3 || resolutionNote.length > 2000) {
    return NextResponse.json({ error: 'Resolution note must be between 3 and 2000 characters' }, { status: 400 })
  }

  const existing = await prisma.suppressionRequest.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Suppression request not found' }, { status: 404 })
  if (existing.status !== 'pending') {
    return NextResponse.json({ error: 'Only pending requests can be reviewed' }, { status: 409 })
  }

  const updated = await prisma.suppressionRequest.update({
    where: { id },
    data: {
      status,
      verificationNote,
      resolutionNote,
      reviewedById: userId,
      reviewedAt: new Date(),
      // Minimize retained contact data after the request is resolved.
      contactEmail: '',
    },
  })

  await createAuditLog(userId, 'REVIEW_SUPPRESSION_REQUEST', {
    suppressionRequestId: id,
    identifierType: existing.identifierType,
    status,
  })

  return NextResponse.json({
    request: {
      id: updated.id,
      identifierType: updated.identifierType,
      status: updated.status,
      resolutionNote: updated.resolutionNote,
      reviewedAt: updated.reviewedAt,
    },
  })
}
