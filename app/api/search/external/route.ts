import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'
import { checkRateLimit } from '@/lib/rate-limit'
import { detectSearchKind, type SearchKind } from '@/lib/search'
import { getProvider } from '@/providers'
import prisma from '@/lib/prisma'
import { hashSuppressionIdentifier, type SuppressionIdentifierType } from '@/lib/suppression'
import type { ProviderSubjectInput } from '@/types'

const VALID_KINDS = new Set<SearchKind>(['auto', 'name', 'phone', 'email', 'address', 'username'])

type RecordLike = Record<string, unknown>

function asRecord(value: unknown): RecordLike | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as RecordLike
    : null
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function fullName(candidate: RecordLike): string | null {
  const direct = stringValue(candidate.FullName)
  if (direct) return direct

  const name = asRecord(candidate.Name)
  if (!name) return null

  return [
    stringValue(name.FirstName),
    stringValue(name.MiddleName),
    stringValue(name.LastName),
  ].filter(Boolean).join(' ').trim() || null
}

function addressText(value: unknown): string | null {
  const address = asRecord(value)
  if (!address) return null

  const street = stringValue(address.AddressLine1) || [
    stringValue(address.HouseNumber),
    stringValue(address.StreetPreDirection),
    stringValue(address.StreetName),
    stringValue(address.StreetType),
    stringValue(address.StreetPostDirection),
    stringValue(address.UnitType),
    stringValue(address.Unit),
  ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()

  const locality = stringValue(address.AddressLine2) || [
    stringValue(address.City),
    stringValue(address.State),
    [stringValue(address.Zip), stringValue(address.Zip4)].filter(Boolean).join('-') || null,
  ].filter(Boolean).join(', ').trim()

  return [street, locality].filter(Boolean).join(', ') || null
}

function phoneText(value: unknown): string | null {
  const phone = asRecord(value)
  if (!phone) return null
  return stringValue(phone.PhoneNumber) || stringValue(phone.Number)
}

function emailText(value: unknown): string | null {
  const email = asRecord(value)
  if (!email) return null
  return stringValue(email.EmailAddress) || stringValue(email.Email)
}

function relationshipName(value: unknown): string | null {
  const relationship = asRecord(value)
  if (!relationship) return null
  return [
    stringValue(relationship.FirstName),
    stringValue(relationship.MiddleName),
    stringValue(relationship.LastName),
  ].filter(Boolean).join(' ').trim() || null
}

function normalizeCandidate(value: unknown, index: number) {
  const candidate = asRecord(value)
  if (!candidate) return null

  const addresses = (Array.isArray(candidate.Addresses) ? candidate.Addresses : [])
    .map(addressText)
    .filter((item): item is string => Boolean(item))
    .slice(0, 10)

  const phones = (Array.isArray(candidate.PhoneNumbers) ? candidate.PhoneNumbers : [])
    .map(phoneText)
    .filter((item): item is string => Boolean(item))
    .slice(0, 10)

  const emailSource = Array.isArray(candidate.Emails)
    ? candidate.Emails
    : Array.isArray(candidate.EmailAddresses)
      ? candidate.EmailAddresses
      : []

  const emails = emailSource
    .map(emailText)
    .filter((item): item is string => Boolean(item))
    .slice(0, 10)

  const relatives = (Array.isArray(candidate.RelativesSummary) ? candidate.RelativesSummary : [])
    .map(relationshipName)
    .filter((item): item is string => Boolean(item))
    .slice(0, 20)

  const associates = (Array.isArray(candidate.AssociatesSummary) ? candidate.AssociatesSummary : [])
    .map(relationshipName)
    .filter((item): item is string => Boolean(item))
    .slice(0, 20)

  return {
    index,
    fullName: fullName(candidate),
    age: numberValue(candidate.Age),
    dob: stringValue(candidate.Dob),
    addresses,
    phones,
    emails,
    relatives,
    associates,
    optedOut: candidate.IsOptedOut === true,
    publicRecord: candidate.IsPublic === true,
  }
}

function providerInput(query: string, kind: Exclude<SearchKind, 'auto'>): ProviderSubjectInput | null {
  switch (kind) {
    case 'name':
      return { fullName: query }
    case 'phone':
      return { fullName: '', phoneE164: query }
    case 'email':
      return { fullName: '', email: query }
    case 'address':
      return { fullName: '', address: query }
    case 'username':
      return null
  }
}

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

  let body: { q?: unknown; type?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const query = typeof body.q === 'string' ? body.q.trim() : ''
  const requestedKind = (typeof body.type === 'string' ? body.type : 'auto') as SearchKind

  if (query.length < 2) {
    return NextResponse.json({ error: 'Search query must be at least 2 characters' }, { status: 400 })
  }
  if (query.length > 200) {
    return NextResponse.json({ error: 'Search query is too long' }, { status: 400 })
  }
  if (!VALID_KINDS.has(requestedKind)) {
    return NextResponse.json({ error: 'Unsupported search type' }, { status: 400 })
  }

  const detectedKind = requestedKind === 'auto' ? detectSearchKind(query) : requestedKind
  const suppressionHash = hashSuppressionIdentifier(
    detectedKind as SuppressionIdentifierType,
    query
  )
  const suppression = await prisma.suppressionRequest.findFirst({
    where: {
      identifierType: detectedKind,
      identifierHash: suppressionHash,
      status: 'approved',
    },
    select: { id: true },
  })

  if (suppression) {
    await createAuditLog(userId, 'RUN_SEARCH', {
      requestedType: requestedKind,
      queryType: detectedKind,
      queryLength: query.length,
      externalProviders: true,
      provider: null,
      persisted: false,
      candidateCount: 0,
      suppressed: true,
    })

    return NextResponse.json({
      available: false,
      queryType: detectedKind,
      candidates: [],
      coverage: {
        provider: null,
        description: 'This identifier is suppressed from AtlasVerify-controlled live enrichment queries.',
      },
      policy: {
        ephemeral: true,
        persisted: false,
        identityProof: false,
        nonFCRA: true,
        suppressed: true,
      },
    }, {
      headers: {
        'Cache-Control': 'no-store, private',
      },
    })
  }

  const input = providerInput(query, detectedKind)

  if (!input) {
    await createAuditLog(userId, 'RUN_SEARCH', {
      requestedType: requestedKind,
      queryType: detectedKind,
      queryLength: query.length,
      externalProviders: true,
      provider: null,
      persisted: false,
      candidateCount: 0,
      unsupportedReason: 'No configured licensed provider supports username search.',
    })

    return NextResponse.json({
      available: false,
      queryType: detectedKind,
      candidates: [],
      coverage: {
        provider: null,
        description: 'Live licensed username search is not available from the configured provider.',
      },
      policy: {
        ephemeral: true,
        persisted: false,
        identityProof: false,
        nonFCRA: true,
      },
    })
  }

  const provider = getProvider('enformion_person_search')
  if (
    !provider ||
    provider.type !== 'person_search' ||
    !provider.lookupSubject ||
    !provider.sourcePolicy.production ||
    provider.sourcePolicy.sourceKind !== 'licensed_api'
  ) {
    await createAuditLog(userId, 'RUN_SEARCH', {
      requestedType: requestedKind,
      queryType: detectedKind,
      queryLength: query.length,
      externalProviders: true,
      provider: 'enformion_person_search',
      configured: false,
      persisted: false,
      candidateCount: 0,
    })

    return NextResponse.json({
      available: false,
      queryType: detectedKind,
      candidates: [],
      coverage: {
        provider: 'enformion_person_search',
        description: 'Licensed people-search is not configured in this environment.',
      },
      policy: {
        ephemeral: true,
        persisted: false,
        identityProof: false,
        nonFCRA: true,
      },
    }, { status: 503 })
  }

  const payload = await provider.lookupSubject(input)

  if (!payload.success) {
    await createAuditLog(userId, 'RUN_SEARCH', {
      requestedType: requestedKind,
      queryType: detectedKind,
      queryLength: query.length,
      externalProviders: true,
      provider: provider.name,
      success: false,
      persisted: false,
      candidateCount: 0,
    })

    return NextResponse.json({
      available: true,
      queryType: detectedKind,
      candidates: [],
      error: payload.error || 'Licensed provider search failed',
      coverage: {
        provider: provider.name,
        description: 'Licensed provider responded without usable results.',
      },
      policy: {
        ephemeral: true,
        persisted: false,
        identityProof: false,
        nonFCRA: true,
        termsUrl: provider.sourcePolicy.termsUrl ?? null,
      },
    }, { status: 502 })
  }

  const rawCandidates = Array.isArray(payload.data.candidates) ? payload.data.candidates : []
  const candidates = rawCandidates
    .slice(0, 10)
    .map((candidate, index) => normalizeCandidate(candidate, index))
    .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate))

  await createAuditLog(userId, 'RUN_SEARCH', {
    requestedType: requestedKind,
    queryType: detectedKind,
    queryLength: query.length,
    externalProviders: true,
    provider: provider.name,
    success: true,
    persisted: false,
    candidateCount: candidates.length,
    providerConfidence: payload.confidenceScore,
  })

  return NextResponse.json({
    available: true,
    queryType: detectedKind,
    provider: {
      name: provider.name,
      sourceKind: provider.sourcePolicy.sourceKind,
      licenseName: provider.sourcePolicy.licenseName ?? null,
      termsUrl: provider.sourcePolicy.termsUrl ?? null,
    },
    candidates,
    confidenceScore: payload.confidenceScore,
    evidenceFacts: payload.evidenceFacts ?? [],
    coverage: {
      provider: provider.name,
      description: 'Live licensed people-search results. Results are leads, not identity proof.',
    },
    policy: {
      ephemeral: true,
      persisted: false,
      identityProof: false,
      nonFCRA: true,
      termsUrl: provider.sourcePolicy.termsUrl ?? null,
    },
  }, {
    headers: {
      'Cache-Control': 'no-store, private',
    },
  })
}
