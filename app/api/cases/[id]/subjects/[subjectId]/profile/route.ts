import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { buildProfileIntelligence } from '@/lib/profile-intelligence'

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

  const facts = subject.enrichmentResults.flatMap(result =>
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
  )

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
    profile: buildProfileIntelligence(facts),
    evidenceFactCount: facts.length,
  })
}
