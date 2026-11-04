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
  const limit = checkRateLimit(userId)
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded', resetIn: limit.resetIn }, { status: 429 })
  }

  let body: { q?: unknown }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const query = typeof body.q === 'string' ? body.q.trim() : ''
  if (query.length < 2 || query.length > 200) {
    return NextResponse.json({ error: 'Court search query must be 2-200 characters.' }, { status: 400 })
  }

  const provider = getProvider('courtlistener_search')
  if (!provider || provider.type !== 'court_record' || !provider.lookup || !provider.sourcePolicy.production) {
    return NextResponse.json({
      available: false,
      results: [],
      coverage: { provider: 'courtlistener_search', description: 'CourtListener API is not configured in this environment.' },
      policy: { persisted: false, identityProof: false, nonFCRA: true },
    }, { status: 503 })
  }

  const payload = await provider.lookup(query)

  await createAuditLog(userId, 'RUN_SEARCH', {
    queryType: 'court_record',
    queryLength: query.length,
    provider: provider.name,
    success: payload.success,
    persisted: false,
    identityProof: false,
  })

  if (!payload.success) {
    return NextResponse.json({
      available: true,
      results: [],
      error: payload.error || 'Court search failed',
      policy: { persisted: false, identityProof: false, nonFCRA: true },
    }, { status: 502, headers: { 'Cache-Control': 'no-store, private' } })
  }

  return NextResponse.json({
    available: true,
    provider: {
      name: provider.name,
      sourceKind: provider.sourcePolicy.sourceKind,
      licenseName: provider.sourcePolicy.licenseName ?? null,
      termsUrl: provider.sourcePolicy.termsUrl ?? null,
    },
    ...payload.data,
    evidenceFacts: payload.evidenceFacts ?? [],
    policy: {
      persisted: false,
      identityProof: false,
      nonFCRA: true,
      description: provider.sourcePolicy.notes,
    },
  }, { headers: { 'Cache-Control': 'no-store, private' } })
}
