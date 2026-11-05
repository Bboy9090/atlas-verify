import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { buildProfileIntelligence } from '@/lib/profile-intelligence'
import { buildEvidenceTimeline, buildRelationshipGraph } from '@/lib/evidence-views'
import { resolveEntityEvidence } from '@/lib/entity-resolution'
import { buildEvidenceFreshnessLedger } from '@/lib/evidence-freshness'
import { rankDuplicateSubjects } from '@/lib/subject-duplicate-review'
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
      case: {
        select: {
          id: true,
          title: true,
          status: true,
        },
      },
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
  const correctedPrimary = applyResolvedEvidenceCorrections(rawFacts)
  const facts = correctedPrimary.facts

  const profile = buildProfileIntelligence(facts)
  const timeline = buildEvidenceTimeline(facts)
  const relationshipGraph = buildRelationshipGraph(subject.id, subject.fullName, profile)
  const resolution = resolveEntityEvidence(facts)
  const freshness = buildEvidenceFreshnessLedger(facts)

  const siblingSubjects = await prisma.subject.findMany({
    where: {
      caseId,
      case: { userId },
      NOT: { id: subject.id },
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
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  const duplicateReview = rankDuplicateSubjects(
    {
      id: subject.id,
      fullName: subject.fullName,
      phoneE164: subject.phoneE164,
      email: subject.email,
      username: subject.username,
      address: subject.address,
      city: subject.city,
      state: subject.state,
      facts,
    },
    siblingSubjects.map(candidate => {
      const candidateRawFacts = candidate.enrichmentResults.flatMap(result =>
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
      const candidateFacts = applyResolvedEvidenceCorrections(candidateRawFacts).facts

      return {
        id: candidate.id,
        fullName: candidate.fullName,
        phoneE164: candidate.phoneE164,
        email: candidate.email,
        username: candidate.username,
        address: candidate.address,
        city: candidate.city,
        state: candidate.state,
        facts: candidateFacts,
      }
    })
  ).slice(0, 10)

  return NextResponse.json({
    subject: {
      id: subject.id,
      fullName: subject.fullName,
      phoneE164: subject.phoneE164,
      email: subject.email,
      username: subject.username,
      address: subject.address,
      city: subject.city,
      state: subject.state,
      notes: subject.notes,
    },
    case: subject.case,
    profile,
    timeline,
    relationshipGraph,
    resolution,
    freshness,
    duplicateReview,
    duplicateReviewPolicy: {
      autoMerge: false,
      identityConfirmed: false,
      description: 'Possible duplicates are review leads only. AtlasVerify never merges subjects automatically.',
    },
    evidenceFactCount: facts.length,
    appliedCorrectionCount: correctedPrimary.corrections.length,
  })
}
