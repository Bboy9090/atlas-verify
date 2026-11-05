import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { checkRateLimit } from '@/lib/rate-limit'
import { createAuditLog } from '@/lib/audit'
import { createCaseShareToken, hashCaseShareToken } from '@/lib/case-share'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const { id } = await params

  const owned = await prisma.case.findFirst({ where: { id, userId }, select: { id: true } })
  if (!owned) return NextResponse.json({ error: 'Case not found' }, { status: 404 })

  const shares = await prisma.caseShare.findMany({
    where: { caseId: id, ownerId: userId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, expiresAt: true, revokedAt: true, createdAt: true },
  })

  return NextResponse.json({ shares }, { headers: { 'Cache-Control': 'no-store, private' } })
}

export async function POST(request: Request, { params }: RouteParams) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const rate = checkRateLimit(`case-share-create:${userId}`)
  if (!rate.allowed) return NextResponse.json({ error: 'Rate limit exceeded', resetIn: rate.resetIn }, { status: 429 })

  const { id } = await params
  const owned = await prisma.case.findFirst({ where: { id, userId }, select: { id: true } })
  if (!owned) return NextResponse.json({ error: 'Case not found' }, { status: 404 })

  const body = await request.json().catch(() => ({}))
  const requestedHours = Number(body?.expiresHours ?? 24)
  if (!Number.isFinite(requestedHours) || requestedHours < 1 || requestedHours > 168) {
    return NextResponse.json({ error: 'expiresHours must be between 1 and 168' }, { status: 400 })
  }

  const token = createCaseShareToken()
  const expiresAt = new Date(Date.now() + Math.round(requestedHours * 60 * 60 * 1000))
  const share = await prisma.caseShare.create({
    data: {
      caseId: id,
      ownerId: userId,
      tokenHash: hashCaseShareToken(token),
      expiresAt,
    },
    select: { id: true, expiresAt: true, createdAt: true },
  })

  await createAuditLog(userId, 'CREATE_CASE_SHARE', {
    caseId: id,
    shareId: share.id,
    expiresAt: share.expiresAt.toISOString(),
  })

  return NextResponse.json({
    share,
    token,
    path: `/share/case/${token}`,
    warning: 'The token is returned once. Store or send it only to intended recipients.',
  }, {
    status: 201,
    headers: { 'Cache-Control': 'no-store, private' },
  })
}
