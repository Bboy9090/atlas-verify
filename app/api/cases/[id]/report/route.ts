import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { createAuditLog } from '@/lib/audit'
import { loadCaseReport } from '@/lib/case-report-server'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, { params }: RouteParams) {
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

  const { id } = await params
  const loaded = await loadCaseReport(id, userId)

  if (!loaded) {
    return NextResponse.json({ error: 'Case not found' }, { status: 404 })
  }

  const { report, suppressedSubjectCount } = loaded

  await createAuditLog(userId, 'EXPORT_CASE_REPORT', {
    caseId: id,
    subjectCount: report.summary.subjectCount,
    suppressedSubjectCount,
    evidenceFactCount: report.summary.evidenceFactCount,
    sourceCount: report.summary.sourceCount,
    reportHash: report.receipt.hash,
    schemaVersion: report.schemaVersion,
  })

  return NextResponse.json(report, {
    headers: {
      'Cache-Control': 'no-store, private',
      'Content-Disposition': `inline; filename="atlasverify-case-${id}.json"`,
    },
  })
}
