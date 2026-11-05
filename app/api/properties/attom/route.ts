import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'
import { checkRateLimit } from '@/lib/rate-limit'
import { getProvider } from '@/providers'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as { id: string }).id
  const rateLimit = checkRateLimit(userId)
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded', resetIn: rateLimit.resetIn }, { status: 429 })
  }

  let body: { q?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const query = typeof body.q === 'string' ? body.q.trim() : ''
  if (query.length < 5 || query.length > 220) {
    return NextResponse.json({ error: 'Property address must be 5-220 characters.' }, { status: 400 })
  }

  const provider = getProvider('attom_property')
  if (!provider || provider.type !== 'property_record' || !provider.lookup) {
    return NextResponse.json({ error: 'ATTOM property provider is unavailable.' }, { status: 503 })
  }

  if (!provider.sourcePolicy.production) {
    await createAuditLog(userId, 'RUN_SEARCH', {
      queryType: 'property_address',
      queryLength: query.length,
      provider: provider.name,
      configured: false,
      persisted: false,
      geographicCoverage: 'United States; county coverage varies',
      currentOwnershipClaimed: false,
    })
    return NextResponse.json({
      available: false,
      coverage: {
        provider: provider.name,
        description: 'ATTOM integration is installed but disabled until ATTOM_API_KEY is configured.',
      },
      policy: {
        geographicCoverage: 'United States; county coverage varies',
        currentOwnershipClaimed: false,
      },
    }, { status: 503 })
  }

  const payload = await provider.lookup(query)

  await createAuditLog(userId, 'RUN_SEARCH', {
    queryType: 'property_address',
    queryLength: query.length,
    provider: provider.name,
    providerType: provider.type,
    sourceKind: provider.sourcePolicy.sourceKind,
    success: payload.success,
    persisted: false,
    geographicCoverage: 'United States; county coverage varies',
    currentOwnershipClaimed: false,
  })

  if (!payload.success) {
    return NextResponse.json(
      { available: true, error: payload.error || 'ATTOM property search failed' },
      { status: 502, headers: { 'Cache-Control': 'no-store, private' } }
    )
  }

  return NextResponse.json(
    {
      available: true,
      provider: {
        name: provider.name,
        sourceKind: provider.sourcePolicy.sourceKind,
        licenseName: provider.sourcePolicy.licenseName ?? null,
        termsUrl: provider.sourcePolicy.termsUrl ?? null,
      },
      data: payload.data,
      confidenceScore: payload.confidenceScore,
      evidenceFacts: payload.evidenceFacts ?? [],
      policy: {
        geographicCoverage: 'United States; county coverage varies',
        currentOwnershipClaimed: false,
        description:
          'Licensed ATTOM property data. Owner names are research leads only; confirm material ownership/title claims against current county recorder or assessor records.',
      },
    },
    { headers: { 'Cache-Control': 'no-store, private' } }
  )
}
