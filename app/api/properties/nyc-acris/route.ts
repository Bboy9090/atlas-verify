import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'
import { checkRateLimit } from '@/lib/rate-limit'
import { getProvider } from '@/providers'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = (session.user as { id: string }).id
  const rateLimit = checkRateLimit(userId)
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded', resetIn: rateLimit.resetIn }, { status: 429 })
  }

  let body: { q?: unknown; mode?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const query = typeof body.q === 'string' ? body.q.trim() : ''
  const mode = body.mode === 'address' ? 'address' : body.mode === 'name' ? 'name' : null

  if (query.length < 2 || query.length > 160) {
    return NextResponse.json({ error: 'Property query must be 2-160 characters.' }, { status: 400 })
  }
  if (!mode) {
    return NextResponse.json({ error: 'Search mode must be name or address.' }, { status: 400 })
  }

  const provider = getProvider('nyc_acris_property')
  if (
    !provider ||
    provider.type !== 'property_record' ||
    !provider.lookup ||
    !provider.sourcePolicy.production
  ) {
    return NextResponse.json({ error: 'NYC ACRIS property provider is unavailable.' }, { status: 503 })
  }

  const payload = await provider.lookup(JSON.stringify({ query, mode }))

  await createAuditLog(userId, 'RUN_SEARCH', {
    queryType: mode === 'name' ? 'property_party_name' : 'property_address',
    queryLength: query.length,
    provider: provider.name,
    providerType: provider.type,
    sourceKind: provider.sourcePolicy.sourceKind,
    success: payload.success,
    persisted: false,
    geographicCoverage: 'NYC',
    currentOwnershipClaimed: false,
  })

  if (!payload.success) {
    return NextResponse.json(
      { available: true, error: payload.error || 'NYC ACRIS search failed' },
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
        geographicCoverage: 'New York City',
        currentOwnershipClaimed: false,
        description:
          'Recorded ACRIS instrument history only. Document parties and roles are time-specific evidence and are not automatically current owners or occupants.',
      },
    },
    { headers: { 'Cache-Control': 'no-store, private' } }
  )
}
