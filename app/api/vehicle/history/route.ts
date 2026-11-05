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

  let body: { vin?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const vin = typeof body.vin === 'string' ? body.vin.trim().toUpperCase() : ''
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
    return NextResponse.json({ error: 'VIN must be exactly 17 characters and cannot contain I, O, or Q.' }, { status: 400 })
  }

  const provider = getProvider('vinaudit_vehicle_history')
  if (
    !provider ||
    provider.type !== 'vehicle_history' ||
    !provider.lookup ||
    !provider.sourcePolicy.production ||
    provider.sourcePolicy.sourceKind !== 'licensed_api'
  ) {
    return NextResponse.json(
      {
        available: false,
        coverage: {
          provider: 'VinAudit vehicle history',
          description: 'Licensed vehicle-history integration is installed but not configured in this environment.',
        },
      },
      { status: 503, headers: { 'Cache-Control': 'no-store, private' } },
    )
  }

  const payload = await provider.lookup(vin)

  await createAuditLog(userId, 'RUN_SEARCH', {
    queryType: 'vehicle_history',
    queryLength: vin.length,
    provider: provider.name,
    providerType: provider.type,
    sourceKind: provider.sourcePolicy.sourceKind,
    success: payload.success,
    persisted: false,
    historyReport: true,
  })

  if (!payload.success) {
    return NextResponse.json(
      {
        available: true,
        provider: {
          name: provider.name,
          sourceKind: provider.sourcePolicy.sourceKind,
          licenseName: provider.sourcePolicy.licenseName ?? null,
          termsUrl: provider.sourcePolicy.termsUrl ?? null,
        },
        error: payload.error || 'Vehicle-history lookup failed.',
      },
      { status: 502, headers: { 'Cache-Control': 'no-store, private' } },
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
        historyReport: true,
        sourceKind: provider.sourcePolicy.sourceKind,
        mayPersist: provider.sourcePolicy.mayPersist,
        description:
          'Licensed vehicle-history source. Records can be incomplete or delayed; absence of an event is not proof it never occurred. Material title, lien, ownership, and legal-status questions require current authoritative verification.',
      },
    },
    { headers: { 'Cache-Control': 'no-store, private' } },
  )
}
