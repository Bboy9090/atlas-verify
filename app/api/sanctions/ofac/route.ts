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
  if (query.length < 3 || query.length > 160) {
    return NextResponse.json({ error: 'Sanctions query must be 3-160 characters.' }, { status: 400 })
  }

  const provider = getProvider('us_treasury_ofac')
  if (!provider || provider.type !== 'sanctions_watchlist' || !provider.lookup || !provider.sourcePolicy.production) {
    return NextResponse.json({ error: 'OFAC sanctions provider is unavailable.' }, { status: 503 })
  }

  const payload = await provider.lookup(query)
  await createAuditLog(userId, 'RUN_SEARCH', {
    queryType: 'sanctions_name',
    queryLength: query.length,
    provider: provider.name,
    providerType: provider.type,
    sourceKind: provider.sourcePolicy.sourceKind,
    success: payload.success,
    persisted: false,
    potentialMatchOnly: true,
    manualVerificationRequired: true,
  })

  if (!payload.success) {
    return NextResponse.json(
      { available: true, error: payload.error || 'OFAC sanctions search failed' },
      { status: 502, headers: { 'Cache-Control': 'no-store, private' } }
    )
  }

  return NextResponse.json({
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
      potentialMatchOnly: true,
      manualVerificationRequired: true,
      nonFCRA: true,
      description:
        'Name and alias screening against official OFAC lists. A result is a candidate for manual review, not proof of identity or sanctions status for the searched person.',
    },
  }, { headers: { 'Cache-Control': 'no-store, private' } })
}
