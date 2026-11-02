import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { Prisma } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { checkRateLimit } from '@/lib/rate-limit'
import { getProvider, getAllProviders } from '@/providers'

interface RouteParams {
  params: Promise<{ id: string; subjectId: string }>
}

// POST run enrichment for subject
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as { id: string }).id
    const { id: caseId, subjectId } = await params
    
    // Check rate limit
    const rateLimit = checkRateLimit(userId)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', resetIn: rateLimit.resetIn },
        { status: 429 }
      )
    }

    // Check case ownership
    const caseData = await prisma.case.findFirst({
      where: { id: caseId, userId }
    })

    if (!caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 })
    }

    const subject = await prisma.subject.findFirst({
      where: { id: subjectId, caseId }
    })

    if (!subject) {
      return NextResponse.json({ error: 'Subject not found' }, { status: 404 })
    }

    const body = await request.json()
    const { providerName } = body

    let providers = getAllProviders()

    const allowSyntheticProviders =
      process.env.NODE_ENV !== 'production' ||
      process.env.ALLOW_SYNTHETIC_PROVIDERS === 'true'

    providers = providers.filter(provider =>
      provider.sourcePolicy.production ||
      (allowSyntheticProviders && provider.sourcePolicy.sourceKind === 'synthetic')
    )
    
    // If specific provider requested
    if (providerName) {
      const provider = getProvider(providerName)
      if (!provider) {
        return NextResponse.json(
          { error: `Provider '${providerName}' not found` },
          { status: 400 }
        )
      }
      const allowed =
        provider.sourcePolicy.production ||
        (allowSyntheticProviders && provider.sourcePolicy.sourceKind === 'synthetic')

      if (!allowed) {
        return NextResponse.json(
          {
            error: `Provider '${providerName}' is not enabled for this environment`,
            sourceKind: provider.sourcePolicy.sourceKind,
          },
          { status: 403 }
        )
      }

      providers = [provider]
    }

    if (providers.length === 0) {
      return NextResponse.json(
        {
          error: 'No production enrichment providers are configured',
          hint: 'Configure a licensed/public provider or explicitly enable synthetic providers outside production.',
        },
        { status: 503 }
      )
    }

    const results = []

    for (const provider of providers) {
      let input = ''
      
      if (provider.type === 'phone_lookup' && subject.phoneE164) {
        input = subject.phoneE164
      } else if (provider.type === 'web_search') {
        input = subject.fullName
      } else {
        continue // Skip if no suitable input
      }

      try {
        const enrichmentPayload = await provider.lookup(input)
        
        const result = await prisma.enrichmentResult.create({
          data: {
            subjectId,
            provider: provider.name,
            providerType: provider.type,
            payload: enrichmentPayload as unknown as Prisma.InputJsonValue,
            confidenceScore: enrichmentPayload.confidenceScore,
            evidenceFacts: enrichmentPayload.evidenceFacts?.length
              ? {
                  create: enrichmentPayload.evidenceFacts.map((fact) => ({
                    field: fact.field,
                    value: fact.value as Prisma.InputJsonValue,
                    sourceName: fact.sourceName,
                    sourceUrl: fact.sourceUrl,
                    retrievedAt: new Date(fact.retrievedAt),
                    observedAt: fact.observedAt ? new Date(fact.observedAt) : undefined,
                    confidenceScore: fact.confidenceScore,
                    corroborationCount: fact.corroborationCount ?? 0,
                    conflictCount: fact.conflictCount ?? 0,
                    metadata: fact.metadata
                      ? (fact.metadata as Prisma.InputJsonValue)
                      : undefined,
                  }))
                }
              : undefined
          },
          include: {
            evidenceFacts: true
          }
        })

        results.push(result)

        // Create audit log
        await createAuditLog(userId, 'RUN_ENRICHMENT', {
          subjectId,
          caseId,
          provider: provider.name,
          providerType: provider.type,
          success: enrichmentPayload.success,
          confidenceScore: enrichmentPayload.confidenceScore
        }, subjectId)
      } catch (err) {
        console.error(`Provider ${provider.name} failed:`, err)
        results.push({
          provider: provider.name,
          error: err instanceof Error ? err.message : 'Unknown error'
        })
      }
    }

    return NextResponse.json({ results })
  } catch (error) {
    console.error('Error running enrichment:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
