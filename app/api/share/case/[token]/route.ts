import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { checkRateLimit } from '@/lib/rate-limit'
import { createAuditLog } from '@/lib/audit'
import { hashCaseShareToken } from '@/lib/case-share'
import { loadCaseReport } from '@/lib/case-report-server'

interface RouteParams {
  params: Promise<{ token: string }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { token } = await params
  if (!token || token.length < 32 || token.length > 128) {
    return NextResponse.json({ error: 'Invalid share link' }, { status: 404 })
  }

  const tokenHash = hashCaseShareToken(token)
  const rate = checkRateLimit(`case-share-read:${tokenHash}`)
  if (!rate.allowed) return NextResponse.json({ error: 'Rate limit exceeded', resetIn: rate.resetIn }, { status: 429 })

  const now = new Date()
  const share = await prisma.caseShare.findUnique({
    where: { tokenHash },
    select: { id: true, caseId: true, ownerId: true, expiresAt: true, revokedAt: true },
  })

  if (!share || share.revokedAt || share.expiresAt <= now) {
    return NextResponse.json({ error: 'Share link is unavailable' }, {
      status: 404,
      headers: { 'Cache-Control': 'no-store, private' },
    })
  }

  const loaded = await loadCaseReport(share.caseId, share.ownerId)
  if (!loaded) return NextResponse.json({ error: 'Share link is unavailable' }, { status: 404 })

  await createAuditLog(share.ownerId, 'ACCESS_CASE_SHARE', {
    caseId: share.caseId,
    shareId: share.id,
    suppressedSubjectCount: loaded.suppressedSubjectCount,
    reportHash: loaded.report.receipt.hash,
  })

  return NextResponse.json({
    readOnly: true,
    expiresAt: share.expiresAt.toISOString(),
    report: loaded.report,
  }, {
    headers: {
      'Cache-Control': 'no-store, private',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
    },
  })
}
