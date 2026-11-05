import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'
import { checkRateLimit } from '@/lib/rate-limit'
import { getProvider } from '@/providers'
import { lookupNhtsaModelRecalls } from '@/lib/nhtsa-recalls'
import { lookupNhtsaModelComplaints } from '@/lib/nhtsa-complaints'

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

  let body: { vin?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const vin = typeof body.vin === 'string' ? body.vin.trim().toUpperCase() : ''
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
    return NextResponse.json(
      { error: 'VIN must be exactly 17 characters and cannot contain I, O, or Q.' },
      { status: 400 }
    )
  }

  const provider = getProvider('nhtsa_vpic')
  if (
    !provider ||
    provider.type !== 'vehicle_vin' ||
    !provider.lookup ||
    !provider.sourcePolicy.production ||
    provider.sourcePolicy.sourceKind !== 'public_record'
  ) {
    return NextResponse.json(
      { error: 'Official VIN provider is not available.' },
      { status: 503 }
    )
  }

  const payload = await provider.lookup(vin)

  let safetyRecalls: {
    available: boolean
    records: Awaited<ReturnType<typeof lookupNhtsaModelRecalls>>['records']
    sourceUrl: string | null
    error: string | null
    scope: 'year_make_model'
    vinSpecificOpenRecall: false
    officialVinRecallUrl: string
  } = {
    available: false,
    records: [],
    sourceUrl: null,
    error: null,
    scope: 'year_make_model',
    vinSpecificOpenRecall: false,
    officialVinRecallUrl: `https://www.nhtsa.gov/recalls?vin=${encodeURIComponent(vin)}`,
  }

  let safetyComplaints: {
    available: boolean
    records: Awaited<ReturnType<typeof lookupNhtsaModelComplaints>>['records']
    sourceUrl: string | null
    error: string | null
    scope: 'year_make_model'
    verifiedDefects: false
    vinSpecific: false
  } = {
    available: false,
    records: [],
    sourceUrl: null,
    error: null,
    scope: 'year_make_model',
    verifiedDefects: false,
    vinSpecific: false,
  }

  if (payload.success) {
    const vehicle = (payload.data as { vehicle?: Record<string, unknown> }).vehicle
    const make = typeof vehicle?.make === 'string' ? vehicle.make.trim() : ''
    const model = typeof vehicle?.model === 'string' ? vehicle.model.trim() : ''
    const modelYear = typeof vehicle?.modelYear === 'string' ? vehicle.modelYear.trim() : ''

    if (make && model && /^\d{4}$/.test(modelYear)) {
      const [recallResult, complaintResult] = await Promise.allSettled([
        lookupNhtsaModelRecalls(make, model, modelYear),
        lookupNhtsaModelComplaints(make, model, modelYear),
      ])

      if (recallResult.status === 'fulfilled') {
        safetyRecalls = {
          ...safetyRecalls,
          available: true,
          records: recallResult.value.records,
          sourceUrl: recallResult.value.sourceUrl,
        }
      } else {
        safetyRecalls = {
          ...safetyRecalls,
          error: recallResult.reason instanceof Error
            ? recallResult.reason.message
            : 'NHTSA recall lookup failed.',
        }
      }

      if (complaintResult.status === 'fulfilled') {
        safetyComplaints = {
          ...safetyComplaints,
          available: true,
          records: complaintResult.value.records,
          sourceUrl: complaintResult.value.sourceUrl,
        }
      } else {
        safetyComplaints = {
          ...safetyComplaints,
          error: complaintResult.reason instanceof Error
            ? complaintResult.reason.message
            : 'NHTSA complaint lookup failed.',
        }
      }
    }
  }

  await createAuditLog(userId, 'RUN_SEARCH', {
    queryType: 'vin',
    queryLength: vin.length,
    provider: provider.name,
    providerType: provider.type,
    sourceKind: provider.sourcePolicy.sourceKind,
    success: payload.success,
    persisted: false,
    historyReport: false,
    recallLookupAttempted: payload.success,
    recallRecordsReturned: safetyRecalls.records.length,
    complaintRecordsReturned: safetyComplaints.records.length,
  })

  if (!payload.success) {
    return NextResponse.json(
      {
        available: true,
        provider: provider.name,
        error: payload.error || 'VIN decode failed',
        policy: {
          sourceKind: provider.sourcePolicy.sourceKind,
          mayPersist: provider.sourcePolicy.mayPersist,
          termsUrl: provider.sourcePolicy.termsUrl ?? null,
          historyReport: false,
        },
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
      safetyRecalls,
      safetyComplaints,
      policy: {
        mayPersist: provider.sourcePolicy.mayPersist,
        historyReport: false,
        description:
          'Official manufacturer-reported VIN decoding plus general NHTSA year/make/model recall and consumer-complaint context when available. Recall matches are not proof that this VIN has an unrepaired recall. Consumer complaints are reports, not verified defect findings, and are not VIN-specific. This is not a title, ownership, accident, lien, registration, or vehicle-history report.',
      },
    },
    {
      headers: { 'Cache-Control': 'no-store, private' },
    }
  )
}
