import type { EnrichmentPayload, EnrichmentProvider, EvidenceFactInput } from '@/types'
import { registerProvider } from './enrichment-provider'

const API_BASE = 'https://api.opencorporates.com/v0.4'
const TERMS_URL = 'https://opencorporates.com/legal-information/self-service-api-terms-of-service/'
const token = process.env.OPENCORPORATES_API_TOKEN?.trim() || ''

interface OpenCorporatesCompany {
  name?: string
  company_number?: string
  jurisdiction_code?: string
  current_status?: string
  incorporation_date?: string
  dissolution_date?: string
  company_type?: string
  branch_status?: string
  inactive?: boolean
  registry_url?: string
  opencorporates_url?: string
  registered_address_in_full?: string
  registered_address?: Record<string, unknown>
  previous_names?: Array<{ company_name?: string; start_date?: string; end_date?: string }>
  source?: { publisher?: string; url?: string; retrieved_at?: string }
}

interface OpenCorporatesSearchResponse {
  results?: {
    total_count?: number
    companies?: Array<{ company?: OpenCorporatesCompany }>
  }
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function fact(
  field: string,
  value: unknown,
  company: OpenCorporatesCompany,
  retrievedAt: string,
  confidenceScore = 0.9,
): EvidenceFactInput | null {
  const normalized = typeof value === 'string' ? value.trim() : value
  if (normalized === null || normalized === undefined || normalized === '') return null

  const companyNumber = str(company.company_number)
  const jurisdiction = str(company.jurisdiction_code)
  const locator = jurisdiction && companyNumber ? `${jurisdiction}:${companyNumber}` : undefined

  return {
    field,
    value: normalized,
    normalizedValue: typeof normalized === 'string' ? normalized.toLowerCase() : undefined,
    sourceName: 'OpenCorporates',
    sourceType: 'licensed_api',
    sourceUrl: str(company.opencorporates_url) || str(company.registry_url) || undefined,
    sourceLocator: locator,
    legalBasis: 'OpenCorporates licensed company-registry data with source attribution',
    retrievedAt,
    confidenceScore,
    corroborationCount: 0,
    conflictCount: 0,
    metadata: {
      provider: 'OpenCorporates',
      jurisdiction,
      companyNumber,
      publisher: str(company.source?.publisher),
      registrySourceUrl: str(company.source?.url) || str(company.registry_url),
      providerRetrievedAt: str(company.source?.retrieved_at),
    },
  }
}

async function openCorporatesSearch(query: string): Promise<OpenCorporatesSearchResponse> {
  if (!token) {
    throw new Error('OPENCORPORATES_API_TOKEN is not configured.')
  }

  const url = new URL(`${API_BASE}/companies/search`)
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

  if (!response.ok) {
    throw new Error(`OpenCorporates returned HTTP ${response.status}.`)
  }

  return response.json() as Promise<OpenCorporatesSearchResponse>
}

const openCorporatesProvider: EnrichmentProvider = {
  name: 'opencorporates',
  type: 'business_entity',
  sourcePolicy: {
    sourceKind: 'licensed_api',
    production: Boolean(token),
    termsUrl: TERMS_URL,
    licenseName: 'OpenCorporates API',
    freshnessSeconds: 86_400,
    allowedPurposes: [
      'Business/entity identity research',
      'Company-registry research',
      'Lawful investigator and compliance research',
    ],
    mayPersist: true,
    notes:
      'Token-gated OpenCorporates company search. Results may aggregate multiple public registries and remain candidate business records, not automatic identity proof.',
  },

  async lookup(input: string): Promise<EnrichmentPayload> {
    const query = input.trim()
    if (query.length < 2) {
      return { success: false, data: {}, confidenceScore: 0, error: 'Business query must be at least 2 characters.' }
    }
    if (!token) {
      return { success: false, data: {}, confidenceScore: 0, error: 'OpenCorporates business search is not configured.' }
    }

    try {
      const payload = await openCorporatesSearch(query)
      const retrievedAt = new Date().toISOString()
      const companies = (payload.results?.companies || [])
        .map(item => item.company)
        .filter((company): company is OpenCorporatesCompany => Boolean(company))
        .slice(0, 20)

      const evidenceFacts: EvidenceFactInput[] = []
      const entities = companies.map(company => {
        const facts = [
          fact('business.name', company.name, company, retrievedAt, 0.88),
          fact('business.company_number', company.company_number, company, retrievedAt, 0.96),
          fact('business.jurisdiction', company.jurisdiction_code, company, retrievedAt, 0.96),
          fact('business.status', company.current_status, company, retrievedAt, 0.9),
          fact('business.incorporation_date', company.incorporation_date, company, retrievedAt, 0.9),
          fact('business.dissolution_date', company.dissolution_date, company, retrievedAt, 0.9),
          fact('business.company_type', company.company_type, company, retrievedAt, 0.88),
          fact('business.registered_address', company.registered_address_in_full, company, retrievedAt, 0.86),
        ].filter((item): item is EvidenceFactInput => Boolean(item))

        for (const previous of company.previous_names || []) {
          const previousFact = fact('business.former_name', previous.company_name, company, retrievedAt, 0.84)
          if (previousFact) {
            previousFact.metadata = {
              ...(previousFact.metadata || {}),
              startDate: str(previous.start_date),
              endDate: str(previous.end_date),
            }
            facts.push(previousFact)
          }
        }

        evidenceFacts.push(...facts)

        return {
          name: str(company.name),
          companyNumber: str(company.company_number),
          jurisdictionCode: str(company.jurisdiction_code),
          currentStatus: str(company.current_status),
          incorporationDate: str(company.incorporation_date),
          dissolutionDate: str(company.dissolution_date),
          companyType: str(company.company_type),
          branchStatus: str(company.branch_status),
          inactive: Boolean(company.inactive),
          registeredAddress: str(company.registered_address_in_full),
          registryUrl: str(company.registry_url),
          sourceUrl: str(company.opencorporates_url) || str(company.registry_url),
          sourcePublisher: str(company.source?.publisher),
          sourceRetrievedAt: str(company.source?.retrieved_at),
          previousNames: (company.previous_names || []).map(previous => ({
            name: str(previous.company_name),
            startDate: str(previous.start_date),
            endDate: str(previous.end_date),
          })).filter(previous => previous.name),
        }
      })

      return {
        success: true,
        data: {
          entities,
          resultCount: entities.length,
          reportedTotalCount: payload.results?.total_count ?? null,
          limitation:
            'OpenCorporates search results are candidate company records from underlying registries. A name match alone is not identity proof; confirm jurisdiction, company number, source registry, dates, and other identifiers.',
        },
        confidenceScore: entities.length ? 0.72 : 0,
        evidenceFacts,
      }
    } catch (error) {
      return {
        success: false,
        data: {},
        confidenceScore: 0,
        error: error instanceof Error ? error.message : 'OpenCorporates lookup failed.',
      }
    }
  },
}

registerProvider(openCorporatesProvider)
