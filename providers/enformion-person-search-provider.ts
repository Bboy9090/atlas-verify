import type {
  EnrichmentProvider,
  EnrichmentPayload,
  EvidenceFactInput,
  ProviderSubjectInput,
} from '@/types'
import { registerProvider } from './enrichment-provider'

const accessProfileName = process.env.ENFORMION_AP_NAME
const accessProfilePassword = process.env.ENFORMION_AP_PASSWORD

interface EnformionAddress {
  AddressLine1?: string
  AddressLine2?: string
  HouseNumber?: string
  StreetPreDirection?: string
  StreetName?: string
  StreetPostDirection?: string
  StreetType?: string
  Unit?: string
  UnitType?: string | null
  City?: string
  State?: string
  County?: string
  Zip?: string
  Zip4?: string
}

interface EnformionPhone {
  PhoneNumber?: string
  Number?: string
}

interface EnformionEmail {
  EmailAddress?: string
  Email?: string
}

interface EnformionPerson {
  TahoeId?: string
  TahoeID?: string
  FullName?: string
  Age?: number
  Dob?: string
  Name?: {
    FirstName?: string
    MiddleName?: string
    LastName?: string
  }
  Addresses?: EnformionAddress[]
  PhoneNumbers?: EnformionPhone[]
  Emails?: EnformionEmail[]
  EmailAddresses?: EnformionEmail[]
  RelativesSummary?: Array<{
    TahoeId?: string
    FirstName?: string
    MiddleName?: string
    LastName?: string
    RelativeType?: string
    Score?: number
  }>
  AssociatesSummary?: Array<{
    TahoeId?: string
    FirstName?: string
    MiddleName?: string
    LastName?: string
    Score?: number
  }>
  Indicators?: Record<string, unknown>
  IsOptedOut?: boolean
  IsPublic?: boolean
}

interface EnformionResponse {
  persons?: EnformionPerson[]
  Persons?: EnformionPerson[]
  requestId?: string
  RequestId?: string
  isError?: boolean
  IsError?: boolean
  message?: string
  Message?: string
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return {}
  if (parts.length === 1) return { FirstName: parts[0] }
  if (parts.length === 2) return { FirstName: parts[0], LastName: parts[1] }
  return {
    FirstName: parts[0],
    MiddleName: parts.slice(1, -1).join(' '),
    LastName: parts.at(-1),
  }
}

function displayName(person: EnformionPerson): string {
  if (person.FullName?.trim()) return person.FullName.trim()
  return [
    person.Name?.FirstName,
    person.Name?.MiddleName,
    person.Name?.LastName,
  ].filter(Boolean).join(' ').trim()
}

function addressText(address: EnformionAddress): string {
  const street = address.AddressLine1?.trim() || [
    address.HouseNumber,
    address.StreetPreDirection,
    address.StreetName,
    address.StreetType,
    address.StreetPostDirection,
    address.UnitType,
    address.Unit,
  ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()

  const locality = address.AddressLine2?.trim() || [
    address.City,
    address.State,
    [address.Zip, address.Zip4].filter(Boolean).join('-'),
  ].filter(Boolean).join(', ').replace(/, ,/g, ',').trim()

  return [street, locality].filter(Boolean).join(', ')
}

function sourceLocator(person: EnformionPerson, requestId?: string): string | undefined {
  const id = person.TahoeId || person.TahoeID
  if (id && requestId) return `person:${id};request:${requestId}`
  if (id) return `person:${id}`
  if (requestId) return `request:${requestId}`
  return undefined
}

function evidenceForPerson(
  person: EnformionPerson,
  index: number,
  retrievedAt: string,
  requestId?: string
): EvidenceFactInput[] {
  const facts: EvidenceFactInput[] = []
  const prefix = `person.candidate.${index}`
  const locator = sourceLocator(person, requestId)
  const common = {
    sourceName: 'EnformionGO Person Search',
    sourceType: 'licensed_api' as const,
    sourceUrl: 'https://enformiongo.readme.io/reference/person-search',
    sourceLocator: locator,
    legalBasis: 'https://go.enformion.com/terms/',
    retrievedAt,
  }

  const name = displayName(person)
  if (name) {
    facts.push({
      ...common,
      field: `${prefix}.name`,
      value: name,
      normalizedValue: name.toLowerCase(),
      confidenceScore: 0.6,
      metadata: { candidateIndex: index, providerCandidate: true },
    })
  }

  if (typeof person.Age === 'number') {
    facts.push({
      ...common,
      field: `${prefix}.age`,
      value: person.Age,
      normalizedValue: String(person.Age),
      confidenceScore: 0.55,
      metadata: { candidateIndex: index, providerCandidate: true },
    })
  }

  if (person.Dob) {
    facts.push({
      ...common,
      field: `${prefix}.dob`,
      value: person.Dob,
      normalizedValue: person.Dob.trim().toLowerCase(),
      confidenceScore: 0.55,
      metadata: { candidateIndex: index, providerCandidate: true },
    })
  }

  for (const [addressIndex, address] of (person.Addresses ?? []).slice(0, 10).entries()) {
    const value = addressText(address)
    if (!value) continue
    facts.push({
      ...common,
      field: `${prefix}.address.${addressIndex}`,
      value,
      normalizedValue: value.toLowerCase(),
      confidenceScore: 0.55,
      metadata: { candidateIndex: index, providerCandidate: true },
    })
  }

  for (const [phoneIndex, phone] of (person.PhoneNumbers ?? []).slice(0, 10).entries()) {
    const value = phone.PhoneNumber || phone.Number
    if (!value) continue
    facts.push({
      ...common,
      field: `${prefix}.phone.${phoneIndex}`,
      value,
      normalizedValue: value.replace(/\D/g, ''),
      confidenceScore: 0.55,
      metadata: { candidateIndex: index, providerCandidate: true },
    })
  }

  const emails = person.Emails ?? person.EmailAddresses ?? []
  for (const [emailIndex, email] of emails.slice(0, 10).entries()) {
    const value = email.EmailAddress || email.Email
    if (!value) continue
    facts.push({
      ...common,
      field: `${prefix}.email.${emailIndex}`,
      value,
      normalizedValue: value.trim().toLowerCase(),
      confidenceScore: 0.55,
      metadata: { candidateIndex: index, providerCandidate: true },
    })
  }

  if (person.RelativesSummary?.length) {
    facts.push({
      ...common,
      field: `${prefix}.relatives`,
      value: person.RelativesSummary.slice(0, 20),
      confidenceScore: 0.5,
      metadata: { candidateIndex: index, providerCandidate: true },
    })
  }

  if (person.AssociatesSummary?.length) {
    facts.push({
      ...common,
      field: `${prefix}.associates`,
      value: person.AssociatesSummary.slice(0, 20),
      confidenceScore: 0.45,
      metadata: { candidateIndex: index, providerCandidate: true },
    })
  }

  if (person.Indicators && Object.keys(person.Indicators).length) {
    facts.push({
      ...common,
      field: `${prefix}.recordIndicators`,
      value: person.Indicators,
      confidenceScore: 0.4,
      metadata: {
        candidateIndex: index,
        providerCandidate: true,
        note: 'Indicators describe provider record availability and are not adjudications or identity proof.',
      },
    })
  }

  return facts
}

function buildCriteria(subject: ProviderSubjectInput): Record<string, unknown> {
  const body: Record<string, unknown> = {
    ...splitName(subject.fullName),
    Page: 1,
    ResultsPerPage: 10,
  }

  if (subject.phoneE164) body.Phone = subject.phoneE164
  if (subject.email) body.Email = subject.email

  if (subject.address || subject.city || subject.state) {
    const address: Record<string, string> = {}
    if (subject.address) address.AddressLine1 = subject.address
    const locality = [subject.city, subject.state].filter(Boolean).join(', ')
    if (locality) address.AddressLine2 = locality
    body.Addresses = [address]
  }

  return body
}

const enformionPersonSearchProvider: EnrichmentProvider = {
  name: 'enformion_person_search',
  type: 'person_search',
  sourcePolicy: {
    sourceKind: 'licensed_api',
    production: true,
    termsUrl: 'https://go.enformion.com/terms/',
    licenseName: 'EnformionGO Person Search',
    freshnessSeconds: 0,
    allowedPurposes: [
      'people_search',
      'identity_research',
      'case_research',
      'public_record_research',
    ],
    mayPersist: false,
    notes:
      'Non-FCRA people-search data. Provider candidates are leads and must be independently matched/corroborated before conclusions are drawn. Persistence stays disabled until account terms/retention rights are reviewed.',
  },

  async lookupSubject(subject: ProviderSubjectInput): Promise<EnrichmentPayload> {
    if (!accessProfileName || !accessProfilePassword) {
      return {
        success: false,
        data: {},
        confidenceScore: 0,
        error: 'EnformionGO access profile is not configured',
      }
    }

    const body = buildCriteria(subject)
    const hasCriterion = Object.keys(body).some(key =>
      !['Page', 'ResultsPerPage'].includes(key)
    )

    if (!hasCriterion) {
      return {
        success: false,
        data: {},
        confidenceScore: 0,
        error: 'At least one person-search criterion is required',
      }
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12_000)

    let response: Response
    try {
      response = await fetch('https://devapi.enformion.com/PersonSearch', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'galaxy-ap-name': accessProfileName,
        'galaxy-ap-password': accessProfilePassword,
        'galaxy-search-type': 'Person',
        'galaxy-client-type': 'AtlasVerify',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: controller.signal,
      })
    } catch (error) {
      return {
        success: false,
        data: {},
        confidenceScore: 0,
        error: error instanceof Error && error.name === 'AbortError'
          ? 'EnformionGO Person Search timed out'
          : 'EnformionGO Person Search request failed',
      }
    } finally {
      clearTimeout(timeout)
    }

    const raw = await response.text()
    let parsed: EnformionResponse | EnformionPerson | EnformionPerson[] = {}
    try {
      parsed = raw ? JSON.parse(raw) : {}
    } catch {
      return {
        success: false,
        data: { status: response.status },
        confidenceScore: 0,
        error: 'EnformionGO returned a non-JSON response',
      }
    }

    if (!response.ok) {
      const message = !Array.isArray(parsed)
        ? (parsed as EnformionResponse).message || (parsed as EnformionResponse).Message
        : undefined
      return {
        success: false,
        data: { status: response.status },
        confidenceScore: 0,
        error: message || `EnformionGO Person Search failed with HTTP ${response.status}`,
      }
    }

    const envelope = Array.isArray(parsed) ? undefined : parsed as EnformionResponse
    if (envelope?.isError || envelope?.IsError) {
      return {
        success: false,
        data: {},
        confidenceScore: 0,
        error: envelope.message || envelope.Message || 'EnformionGO reported an error',
      }
    }

    let persons: EnformionPerson[] = []
    if (Array.isArray(parsed)) {
      persons = parsed
    } else {
      const maybeEnvelope = parsed as EnformionResponse
      persons = maybeEnvelope.persons ?? maybeEnvelope.Persons ?? []
      if (!persons.length && ('FullName' in parsed || 'TahoeId' in parsed || 'TahoeID' in parsed)) {
        persons = [parsed as EnformionPerson]
      }
    }

    const requestId = envelope?.requestId || envelope?.RequestId
    const retrievedAt = new Date().toISOString()
    const evidenceFacts = persons
      .slice(0, 10)
      .flatMap((person, index) => evidenceForPerson(person, index, retrievedAt, requestId))

    return {
      success: true,
      data: {
        candidates: persons.slice(0, 10),
        candidateCount: persons.length,
        requestId: requestId ?? null,
        providerOrderIsIdentityProof: false,
      },
      confidenceScore: persons.length ? 0.5 : 0,
      evidenceFacts,
    }
  },
}

if (accessProfileName && accessProfilePassword) {
  registerProvider(enformionPersonSearchProvider)
}

export default enformionPersonSearchProvider
