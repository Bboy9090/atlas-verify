import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { checkRateLimit } from '@/lib/rate-limit'
import { createAuditLog } from '@/lib/audit'
import { detectSearchKind, scoreSubjectMatch, type SearchKind } from '@/lib/search'

const VALID_KINDS = new Set<SearchKind>(['auto', 'name', 'phone', 'email', 'address'])

export async function GET(request: NextRequest) {
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

  const query = request.nextUrl.searchParams.get('q')?.trim() ?? ''
  const requestedKind = (request.nextUrl.searchParams.get('type') ?? 'auto') as SearchKind

  if (query.length < 2) {
    return NextResponse.json({ error: 'Search query must be at least 2 characters' }, { status: 400 })
  }

  if (query.length > 200) {
    return NextResponse.json({ error: 'Search query is too long' }, { status: 400 })
  }

  if (!VALID_KINDS.has(requestedKind)) {
    return NextResponse.json({ error: 'Unsupported search type' }, { status: 400 })
  }

  const detectedKind = requestedKind === 'auto' ? detectSearchKind(query) : requestedKind

  const subjects = await prisma.subject.findMany({
    where: {
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
        select: {
          timestamp: true,
          confidenceScore: true,
          evidenceFacts: {
            select: {
              sourceName: true,
              retrievedAt: true,
            },
          },
        },
        orderBy: { timestamp: 'desc' },
        take: 10,
      },
    },
    take: 250,
  })

  const candidates = subjects
    .map(subject => {
      const match = scoreSubjectMatch(subject, query, requestedKind)
      const evidenceFacts = subject.enrichmentResults.flatMap(result => result.evidenceFacts)
      const uniqueSources = Array.from(new Set(evidenceFacts.map(fact => fact.sourceName))).sort()
      const latestEvidenceAt = evidenceFacts
        .map(fact => fact.retrievedAt)
        .sort((a, b) => b.getTime() - a.getTime())[0]

      const evidenceBonus = Math.min(0.08, uniqueSources.length * 0.02)
      const rankedScore = Math.min(1, match.score + evidenceBonus)

      return {
        subject: {
          id: subject.id,
          fullName: subject.fullName,
          phoneE164: subject.phoneE164,
          email: subject.email,
          address: subject.address,
          city: subject.city,
          state: subject.state,
        },
        case: subject.case,
        score: rankedScore,
        baseMatchScore: match.score,
        matchedFields: match.matchedFields,
        evidence: {
          factCount: evidenceFacts.length,
          sourceCount: uniqueSources.length,
          sources: uniqueSources,
          latestEvidenceAt: latestEvidenceAt?.toISOString() ?? null,
        },
      }
    })
    .filter(candidate => candidate.baseMatchScore > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 50)

  await createAuditLog(userId, 'RUN_SEARCH', {
    queryType: detectedKind,
    requestedType: requestedKind,
    queryLength: query.length,
    candidateCount: candidates.length,
    coverage: {
      workspace: true,
      externalProviders: false,
    },
  })

  return NextResponse.json({
    query,
    requestedKind,
    detectedKind,
    candidates,
    coverage: {
      workspace: {
        enabled: true,
        description: 'Searches subjects already stored in your AtlasVerify cases.',
      },
      externalProviders: {
        enabled: false,
        description: 'No live licensed/public people-search provider is configured yet.',
      },
    },
  })
}
