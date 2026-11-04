import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { createAuditLog } from '@/lib/audit'
import '@/providers'
import { getProvider } from '@/providers/enrichment-provider'

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

  const username = request.nextUrl.searchParams.get('username')?.trim() ?? ''
  if (username.length < 2 || username.length > 80) {
    return NextResponse.json({ error: 'Username must be between 2 and 80 characters' }, { status: 400 })
  }

  const provider = getProvider('brave_public_profile_search')
  if (!provider?.lookup) {
    return NextResponse.json(
      {
        available: false,
        results: [],
        coverage: 'Public profile provider is not configured.',
        identityConfirmed: false,
      },
      { status: 503 }
    )
  }

  const payload = await provider.lookup(username)

  await createAuditLog(userId, 'RUN_SEARCH', {
    queryType: 'public_profile_username',
    queryLength: username.length,
    provider: provider.name,
    providerSuccess: payload.success,
    resultCount: Array.isArray(payload.data.results) ? payload.data.results.length : 0,
    identityConfirmed: false,
  })

  if (!payload.success) {
    return NextResponse.json(
      {
        available: true,
        results: [],
        error: payload.error || 'Profile search failed',
        identityConfirmed: false,
      },
      { status: 502 }
    )
  }

  return NextResponse.json({
    available: true,
    provider: {
      name: provider.name,
      sourceKind: provider.sourcePolicy.sourceKind,
      licenseName: provider.sourcePolicy.licenseName ?? null,
      termsUrl: provider.sourcePolicy.termsUrl ?? null,
      mayPersist: provider.sourcePolicy.mayPersist,
    },
    ...payload.data,
    evidenceFacts: payload.evidenceFacts ?? [],
    identityConfirmed: false,
    policy: {
      leadOnly: true,
      corroborationRequired: true,
      persisted: false,
      identityConfirmed: false,
    },
  })
}
