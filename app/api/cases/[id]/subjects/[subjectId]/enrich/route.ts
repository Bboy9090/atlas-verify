import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
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
    
    // If specific provider requested
    if (providerName) {
      const provider = getProvider(providerName)
      if (!provider) {
        return NextResponse.json(
          { error: `Provider '${providerName}' not found` },
          { status: 400 }
        )
      }
      providers = [provider]
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
            payload: enrichmentPayload as unknown as Record<string, unknown>,
            confidenceScore: enrichmentPayload.confidenceScore
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
