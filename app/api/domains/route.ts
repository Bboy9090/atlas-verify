import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { createAuditLog } from '@/lib/audit'
import '@/providers'
import { getProvider } from '@/providers/enrichment-provider'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as { id: string }).id
  const rateLimit = checkRateLimit(userId)
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded', resetIn: rateLimit.resetIn }, { status: 429 })
  }

  const domain = request.nextUrl.searchParams.get('domain')?.trim() ?? ''
  if (domain.length < 3 || domain.length > 253) {
    return NextResponse.json({ error: 'Enter a valid domain name' }, { status: 400 })
  }

  const provider = getProvider('iana_authoritative_rdap')
  if (!provider?.lookup) {
    return NextResponse.json({ error: 'RDAP provider unavailable' }, { status: 503 })
  }

  const payload = await provider.lookup(domain)

  await createAuditLog(userId, 'RUN_SEARCH', {
    queryType: 'domain_rdap',
    queryLength: domain.length,
    provider: provider.name,
    providerSuccess: payload.success,
    publicOnly: true,
  })

  if (!payload.success) {
    return NextResponse.json(
      { available: true, error: payload.error || 'Domain lookup failed', data: payload.data },
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
    },
    data: payload.data,
    evidenceFacts: payload.evidenceFacts ?? [],
    policy: {
      publicOnly: true,
      redactedDataRecovered: false,
      identityConfirmed: false,
    },
  })
}
