import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { checkRateLimit } from '@/lib/rate-limit'
import { createAuditLog } from '@/lib/audit'
import { buildCaseReport } from '@/lib/case-report'

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
  const caseData = await prisma.case.findFirst({
    where: { id, userId },
    include: {
      subjects: {
        orderBy: { createdAt: 'asc' },
        include: {
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

  if (!caseData) {
    return NextResponse.json({ error: 'Case not found' }, { status: 404 })
  }

  const report = buildCaseReport({
    id: caseData.id,
    title: caseData.title,
    description: caseData.description,
    status: caseData.status,
    createdAt: caseData.createdAt,
    updatedAt: caseData.updatedAt,
    subjects: caseData.subjects.map(subject => ({
      id: subject.id,
      fullName: subject.fullName,
      phoneE164: subject.phoneE164,
      email: subject.email,
      username: subject.username,
      address: subject.address,
      city: subject.city,
      state: subject.state,
      notes: subject.notes,
      createdAt: subject.createdAt,
      evidenceFacts: subject.enrichmentResults.flatMap(result =>
        result.evidenceFacts.map(fact => ({
          id: fact.id,
          field: fact.field,
          value: fact.value,
          sourceName: fact.sourceName,
          sourceType: fact.sourceType,
          sourceUrl: fact.sourceUrl,
          sourceLocator: fact.sourceLocator,
          normalizedValue: fact.normalizedValue,
          rawRecordHash: fact.rawRecordHash,
          legalBasis: fact.legalBasis,
          retrievedAt: fact.retrievedAt,
          observedAt: fact.observedAt,
          confidenceScore: fact.confidenceScore,
          corroborationCount: fact.corroborationCount,
          conflictCount: fact.conflictCount,
        }))
      ),
    })),
  })

  await createAuditLog(userId, 'EXPORT_CASE_REPORT', {
    caseId: id,
    subjectCount: report.summary.subjectCount,
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
