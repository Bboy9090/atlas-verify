import type { EnrichmentPayload, EnrichmentProvider, EvidenceFactInput } from '@/types'
import { registerProvider } from './enrichment-provider'

const API_BASE = 'https://api.opencorporates.com/v0.4'
const TERMS_URL = 'https://opencorporates.com/legal-information/self-service-api-terms-of-service/'
const token = process.env.OPENCORPORATES_API_TOKEN?.trim() || ''

interface OfficerCompany {
  name?: string
  company_number?: string
  jurisdiction_code?: string
  opencorporates_url?: string
}

interface OpenCorporatesOfficer {
  id?: number
  name?: string
  position?: string
  start_date?: string
  end_date?: string
  current_status?: string
  inactive?: boolean
  opencorporates_url?: string
  occupation?: string
  company?: OfficerCompany
  source?: {
    publisher?: string
    url?: string
    retrieved_at?: string
  }
}

interface OfficerSearchResponse {
  results?: {
    total_count?: number
    officers?: Array<{ officer?: OpenCorporatesOfficer }>
  }
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function fact(
  field: string,
  value: unknown,
  officer: OpenCorporatesOfficer,
  retrievedAt: string,
  confidenceScore = 0.88,
): EvidenceFactInput | null {
  const normalized = typeof value === 'string' ? value.trim() : value
  if (normalized === null || normalized === undefined || normalized === '') return null

  return {
    field,
    value: normalized,
    normalizedValue: typeof normalized === 'string' ? normalized.toLowerCase() : undefined,
    sourceName: 'OpenCorporates',
    sourceType: 'licensed_api',
    sourceUrl: str(officer.opencorporates_url) || str(officer.company?.opencorporates_url) || undefined,
    sourceLocator: officer.id ? `officer:${officer.id}` : undefined,
    legalBasis: 'OpenCorporates licensed company-registry officer data with source attribution',
    retrievedAt,
    confidenceScore,
    corroborationCount: 0,
    conflictCount: 0,
    metadata: {
      provider: 'OpenCorporates',
      officerId: officer.id ?? null,
      companyNumber: str(officer.company?.company_number),
      jurisdiction: str(officer.company?.jurisdiction_code),
      publisher: str(officer.source?.publisher),
      registrySourceUrl: str(officer.source?.url),
      providerRetrievedAt: str(officer.source?.retrieved_at),
    },
  }
}

async function searchOfficers(query: string): Promise<OfficerSearchResponse> {
  if (!token) throw new Error('OPENCORPORATES_API_TOKEN is not configured.')

  const url = new URL(`${API_BASE}/officers/search`)
  url.searchParams.set('q', query)
  url.searchParams.set('order', 'score')
  url.searchParams.set('per_page', '20')

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'X-API-TOKEN': token,
    },
    cache: 'no-store',
  })

  if (!response.ok) throw new Error(`OpenCorporates returned HTTP ${response.status}.`)
  return response.json() as Promise<OfficerSearchResponse>
}

const provider: EnrichmentProvider = {
  name: 'opencorporates-officers',
  type: 'business_entity',
  sourcePolicy: {
    sourceKind: 'licensed_api',
    production: Boolean(token),
    termsUrl: TERMS_URL,
    licenseName: 'OpenCorporates API',
    freshnessSeconds: 86_400,
    allowedPurposes: [
      'Business officer/director research',
      'Company-association research',
      'Lawful investigator and compliance research',
    ],
    mayPersist: false,
    notes:
      'Token-gated public-registry officer associations. Results are leads only; Atlas does not expose date of birth or personal-address fields and does not treat a name match as identity proof.',
  },

  async lookup(input: string): Promise<EnrichmentPayload> {
    const query = input.trim()
    if (query.length < 2) {
      return { success: false, data: {}, confidenceScore: 0, error: 'Officer query must be at least 2 characters.' }
    }
    if (!token) {
      return { success: false, data: {}, confidenceScore: 0, error: 'OpenCorporates officer search is not configured.' }
    }

    try {
      const payload = await searchOfficers(query)
      const retrievedAt = new Date().toISOString()
      const officers = (payload.results?.officers || [])
        .map(item => item.officer)
        .filter((officer): officer is OpenCorporatesOfficer => Boolean(officer))
        .slice(0, 20)

      const evidenceFacts: EvidenceFactInput[] = []
      const results = officers.map(officer => {
        const facts = [
          fact('business.officer.name', officer.name, officer, retrievedAt, 0.84),
          fact('business.officer.position', officer.position, officer, retrievedAt, 0.88),
          fact('business.officer.start_date', officer.start_date, officer, retrievedAt, 0.88),
          fact('business.officer.end_date', officer.end_date, officer, retrievedAt, 0.88),
          fact('business.name', officer.company?.name, officer, retrievedAt, 0.9),
          fact('business.company_number', officer.company?.company_number, officer, retrievedAt, 0.94),
          fact('business.jurisdiction', officer.company?.jurisdiction_code, officer, retrievedAt, 0.94),
        ].filter((item): item is EvidenceFactInput => Boolean(item))

        evidenceFacts.push(...facts)

        return {
          officerId: officer.id ?? null,
          name: str(officer.name),
          position: str(officer.position),
          startDate: str(officer.start_date),
          endDate: str(officer.end_date),
          currentStatus: str(officer.current_status),
          inactive: Boolean(officer.inactive),
          occupation: str(officer.occupation),
          sourceUrl: str(officer.opencorporates_url),
          sourcePublisher: str(officer.source?.publisher),
          company: {
            name: str(officer.company?.name),
            companyNumber: str(officer.company?.company_number),
            jurisdictionCode: str(officer.company?.jurisdiction_code),
            sourceUrl: str(officer.company?.opencorporates_url),
          },
        }
      })

      return {
        success: true,
        data: {
          officers: results,
          resultCount: results.length,
          reportedTotalCount: payload.results?.total_count ?? null,
          limitation:
            'Officer-name matches are public-registry association leads, not proof that two same-named people are the same person. Confirm company, jurisdiction, role, dates and independent identifiers.',
        },
        confidenceScore: results.length ? 0.68 : 0,
        evidenceFacts,
      }
    } catch (error) {
      return {
        success: false,
        data: {},
        confidenceScore: 0,
        error: error instanceof Error ? error.message : 'OpenCorporates officer lookup failed.',
      }
    }
  },
}

registerProvider(provider)
