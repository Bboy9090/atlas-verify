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
  if (query.length < 2 || query.length > 200) {
    return NextResponse.json({ error: 'Business query must be 2-200 characters.' }, { status: 400 })
  }

  const provider = getProvider('opencorporates')
  if (!provider || provider.type !== 'business_entity' || !provider.lookup) {
    return NextResponse.json({ error: 'OpenCorporates provider is unavailable.' }, { status: 503 })
  }

  if (!provider.sourcePolicy.production) {
    await createAuditLog(userId, 'RUN_SEARCH', {
      queryType: 'business_entity',
      queryLength: query.length,
      provider: provider.name,
      configured: false,
      persisted: false,
    })
    return NextResponse.json({
      available: false,
      coverage: {
        provider: provider.name,
        description: 'OpenCorporates integration is installed but disabled until OPENCORPORATES_API_TOKEN is configured.',
      },
      policy: {
        broadRegistryCoverage: true,
        identityProof: false,
      },
    }, { status: 503 })
  }

  const payload = await provider.lookup(query)

  await createAuditLog(userId, 'RUN_SEARCH', {
    queryType: 'business_entity',
    queryLength: query.length,
    provider: provider.name,
    sourceKind: provider.sourcePolicy.sourceKind,
    success: payload.success,
    persisted: false,
  })

  if (!payload.success) {
    return NextResponse.json(
      { available: true, error: payload.error || 'OpenCorporates search failed' },
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
        broadRegistryCoverage: true,
        identityProof: false,
        description:
          'Candidate company records from OpenCorporates and its underlying registries. Confirm jurisdiction, company number, source registry and dates before treating records as the same entity.',
      },
    },
    { headers: { 'Cache-Control': 'no-store, private' } }
  )
}
