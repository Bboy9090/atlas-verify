import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { summarizeEvidence } from '@/lib/evidence'
import { applyResolvedEvidenceCorrections } from '@/lib/evidence-corrections'

interface RouteParams {
  params: Promise<{ id: string; subjectId: string }>
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
                where: { userId, status: 'resolved' },
                orderBy: { resolvedAt: 'desc' },
                select: {
                  id: true,
                  status: true,
                  requestedValue: true,
                  resolutionNote: true,
                  resolvedAt: true,
                  updatedAt: true,
                },
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

  const rawFacts = subject.enrichmentResults.flatMap(result =>
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
      disputes: fact.disputes,
    }))
  )
  const corrected = applyResolvedEvidenceCorrections(rawFacts)
  const correctionByFactId = new Map(
    corrected.corrections.map(correction => [correction.evidenceFactId, correction])
  )
  const facts = corrected.facts.map(fact => {
    const correction = fact.id ? correctionByFactId.get(fact.id) : undefined
    const original = rawFacts.find(raw => raw.id === fact.id)
    return {
      ...fact,
      originalValue: correction ? original?.value : undefined,
      correction: correction ?? null,
    }
  })

  return NextResponse.json({
    subject: {
      id: subject.id,
      fullName: subject.fullName,
    },
    summary: summarizeEvidence(corrected.facts),
    appliedCorrectionCount: corrected.corrections.length,
    facts,
  })
}
