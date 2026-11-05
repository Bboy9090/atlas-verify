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

  let body: { plate?: unknown; state?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const plate = typeof body.plate === 'string' ? body.plate.trim().toUpperCase() : ''
  const state = typeof body.state === 'string' ? body.state.trim().toUpperCase() : ''
  if (!plate || plate.length > 10 || !/^[A-Z0-9 -]+$/.test(plate)) {
    return NextResponse.json({ error: 'Plate must be 1-10 letters, numbers, spaces, or hyphens.' }, { status: 400 })
  }
  if (!/^[A-Z]{2}$/.test(state)) {
    return NextResponse.json({ error: 'State must be a two-letter U.S. state or DC code.' }, { status: 400 })
  }

  const provider = getProvider('vinaudit_plate_to_vin')
  if (
    !provider ||
    provider.type !== 'plate_to_vin' ||
    !provider.lookup ||
    !provider.sourcePolicy.production ||
    provider.sourcePolicy.sourceKind !== 'licensed_api'
  ) {
    return NextResponse.json(
      {
        available: false,
        coverage: {
          provider: 'VinAudit Plate to VIN',
          description: 'Licensed plate-to-VIN integration is installed but not configured in this environment.',
        },
      },
      { status: 503, headers: { 'Cache-Control': 'no-store, private' } },
    )
  }

  const payload = await provider.lookup(`${state}|${plate}`)

  await createAuditLog(userId, 'RUN_SEARCH', {
    queryType: 'plate_to_vin',
    queryLength: plate.length,
    provider: provider.name,
    providerType: provider.type,
    sourceKind: provider.sourcePolicy.sourceKind,
    success: payload.success,
    persisted: false,
    stateProvided: Boolean(state),
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
        error: payload.error || 'Plate-to-VIN lookup failed.',
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
        mayPersist: false,
        ownershipIdentityEstablished: false,
        registrationIdentityEstablished: false,
        description:
          'Licensed plate-to-VIN resolution only. This does not establish ownership, current registration, address, residence, or person identity.',
      },
    },
    { headers: { 'Cache-Control': 'no-store, private' } },
  )
}
