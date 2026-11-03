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
    return NextResponse.json(
      { error: 'Rate limit exceeded', resetIn: rateLimit.resetIn },
      { status: 429 }
    )
  }

  let body: { npi?: unknown; name?: unknown; state?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const npi = typeof body.npi === 'string' ? body.npi.trim() : ''
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const state = typeof body.state === 'string' ? body.state.trim().toUpperCase() : ''

  if (!npi && name.length < 2) {
    return NextResponse.json({ error: 'Provide a 10-digit NPI or provider name.' }, { status: 400 })
  }
  if (npi && !/^\d{10}$/.test(npi)) {
    return NextResponse.json({ error: 'NPI must be exactly 10 digits.' }, { status: 400 })
  }
  if (state && !/^[A-Z]{2}$/.test(state)) {
    return NextResponse.json({ error: 'State must be a two-letter code.' }, { status: 400 })
  }

  const provider = getProvider('cms_nppes')
  if (
    !provider ||
    provider.type !== 'professional_license' ||
    !provider.lookup ||
    !provider.sourcePolicy.production ||
    provider.sourcePolicy.sourceKind !== 'public_record'
  ) {
    return NextResponse.json({ error: 'NPPES provider is not available.' }, { status: 503 })
  }

  const payload = await provider.lookup(JSON.stringify({ npi: npi || undefined, name: name || undefined, state: state || undefined }))

  await createAuditLog(userId, 'RUN_SEARCH', {
    queryType: npi ? 'npi' : 'professional_license',
    queryLength: npi ? npi.length : name.length,
    provider: provider.name,
    providerType: provider.type,
    sourceKind: provider.sourcePolicy.sourceKind,
    success: payload.success,
    persisted: false,
    activeLicenseStatusVerified: false,
  })

  if (!payload.success) {
    return NextResponse.json(
      {
        available: true,
        error: payload.error || 'NPPES search failed',
        provider: provider.name,
      },
      {
        status: 502,
        headers: { 'Cache-Control': 'no-store, private' },
      }
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
        mayPersist: provider.sourcePolicy.mayPersist,
        healthcareOnly: true,
        activeLicenseStatusVerified: false,
        description:
          'Official CMS/NPPES healthcare-provider data. Reported license identifiers require issuing-board verification before treating them as current or active.',
      },
    },
    {
      headers: { 'Cache-Control': 'no-store, private' },
    }
  )
}
