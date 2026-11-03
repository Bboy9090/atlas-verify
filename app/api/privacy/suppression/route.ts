import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { checkRateLimit } from '@/lib/rate-limit'
import {
  createSuppressionRequestToken,
  hashSuppressionIdentifier,
  hashSuppressionRequestToken,
  normalizeSuppressionIdentifier,
  type SuppressionIdentifierType,
} from '@/lib/suppression'

const TYPES = new Set<SuppressionIdentifierType>(['name', 'phone', 'email', 'address', 'username'])
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: NextRequest) {
  let body: { identifierType?: unknown; identifier?: unknown; contactEmail?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const identifierType = typeof body.identifierType === 'string'
    ? body.identifierType as SuppressionIdentifierType
    : 'name'
  const identifier = typeof body.identifier === 'string' ? body.identifier.trim() : ''
  const contactEmail = typeof body.contactEmail === 'string' ? body.contactEmail.trim().toLowerCase() : ''

  if (!TYPES.has(identifierType)) {
    return NextResponse.json({ error: 'Unsupported identifier type' }, { status: 400 })
  }
  if (identifier.length < 2 || identifier.length > 300) {
    return NextResponse.json({ error: 'Identifier must be between 2 and 300 characters' }, { status: 400 })
  }
  if (!EMAIL_RE.test(contactEmail) || contactEmail.length > 320) {
    return NextResponse.json({ error: 'A valid contact email is required' }, { status: 400 })
  }

  const normalized = normalizeSuppressionIdentifier(identifierType, identifier)
  if (!normalized) {
    return NextResponse.json({ error: 'Identifier is invalid' }, { status: 400 })
  }

  const identifierHash = hashSuppressionIdentifier(identifierType, identifier)
  const rateLimit = checkRateLimit(`suppression:${identifierHash}`)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests for this identifier', resetIn: rateLimit.resetIn },
      { status: 429 }
    )
  }

  const existing = await prisma.suppressionRequest.findFirst({
    where: {
      identifierType,
      identifierHash,
      status: { in: ['pending', 'approved'] },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (existing?.status === 'approved') {
    return NextResponse.json({
      status: 'approved',
      message: 'This identifier is already suppressed from future AtlasVerify-controlled live enrichment queries.',
    })
  }

  if (existing?.status === 'pending') {
    return NextResponse.json({
      status: 'pending',
      message: 'A suppression request for this identifier is already pending review.',
    })
  }

  const { token, hash } = createSuppressionRequestToken()

  await prisma.suppressionRequest.create({
    data: {
      requestTokenHash: hash,
      identifierType,
      identifierHash,
      contactEmail,
    },
  })

  return NextResponse.json({
    status: 'pending',
    requestToken: token,
    message: 'Suppression request submitted. Save this request token to check status.',
  }, {
    status: 201,
    headers: {
      'Cache-Control': 'no-store, private',
    },
  })
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')?.trim() || ''
  if (token.length < 20 || token.length > 200) {
    return NextResponse.json({ error: 'Valid request token required' }, { status: 400 })
  }

  const requestTokenHash = hashSuppressionRequestToken(token)
  const record = await prisma.suppressionRequest.findUnique({
    where: { requestTokenHash },
    select: {
      id: true,
      identifierType: true,
      status: true,
      resolutionNote: true,
      reviewedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  if (!record) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 })
  }

  return NextResponse.json(record, {
    headers: {
      'Cache-Control': 'no-store, private',
    },
  })
}
