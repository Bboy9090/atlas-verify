import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'

interface RouteParams {
  params: Promise<{ id: string; shareId: string }>
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const { id, shareId } = await params

  const share = await prisma.caseShare.findFirst({
    where: { id: shareId, caseId: id, ownerId: userId },
    select: { id: true, revokedAt: true },
  })
  if (!share) return NextResponse.json({ error: 'Share not found' }, { status: 404 })

  if (!share.revokedAt) {
    await prisma.caseShare.update({
      where: { id: share.id },
      data: { revokedAt: new Date() },
    })
    await createAuditLog(userId, 'REVOKE_CASE_SHARE', { caseId: id, shareId: share.id })
  }

  return NextResponse.json({ revoked: true }, { headers: { 'Cache-Control': 'no-store, private' } })
}
