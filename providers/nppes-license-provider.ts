import type { EnrichmentPayload, EnrichmentProvider, EvidenceFactInput } from '@/types'
import { registerProvider } from './enrichment-provider'

const API_BASE = 'https://npiregistry.cms.hhs.gov/api/'
const TERMS_URL = 'https://npiregistry.cms.hhs.gov/api-page'

interface NppesResponse {
  result_count?: number
  results?: Array<Record<string, unknown>>
}

interface SearchInput {
  npi?: string
  name?: string
  state?: string
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function bool(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

function normalizeName(basic: Record<string, unknown> | null): string | null {
  if (!basic) return null
  const org = str(basic.organization_name)
  if (org) return org
  return [
    str(basic.first_name),
    str(basic.middle_name),
    str(basic.last_name),
    str(basic.name_suffix),
  ].filter(Boolean).join(' ').trim() || null
}

function fact(
  field: string,
  value: unknown,
  npi: string | null,
  retrievedAt: string,
  sourceUrl: string,
  confidenceScore = 0.98,
  metadata?: Record<string, unknown>
): EvidenceFactInput | null {
  const normalized = typeof value === 'string' ? value.trim() : value
  if (normalized === null || normalized === undefined || normalized === '') return null

  return {
    field,
    value: normalized,
    normalizedValue: typeof normalized === 'string' ? normalized.toLowerCase() : undefined,
    sourceName: 'CMS NPPES NPI Registry',
    sourceType: 'public_record',
    sourceUrl,
    sourceLocator: npi ? `NPI:${npi}` : 'NPPES search result',
    legalBasis: 'Public U.S. CMS/NPPES provider registry data',
    retrievedAt,
    confidenceScore,
    corroborationCount: 0,
    conflictCount: 0,
    metadata: {
      registry: 'NPPES NPI Registry',
      licenseStatusVerified: false,
      ...metadata,
    },
  }
}

function buildPersonParams(name: string, state?: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const params = new URLSearchParams({ version: '2.1', limit: '20' })
  if (parts.length === 1) {
    params.set('last_name', parts[0])
  } else {
    params.set('first_name', parts.slice(0, -1).join(' '))
    params.set('last_name', parts[parts.length - 1])
  }
  if (state) params.set('state', state)
  return params
}

function buildOrgParams(name: string, state?: string) {
  const params = new URLSearchParams({
    version: '2.1',
    limit: '20',
    organization_name: name,
  })
  if (state) params.set('state', state)
  return params
}

async function fetchNppes(params: URLSearchParams): Promise<{ response: NppesResponse; sourceUrl: string }> {
  const sourceUrl = `${API_BASE}?${params.toString()}`
  const response = await fetch(sourceUrl, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'AtlasVerify/1.0',
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`NPPES returned HTTP ${response.status}.`)
  }

  return {
    response: await response.json() as NppesResponse,
    sourceUrl,
  }
}

const nppesLicenseProvider: EnrichmentProvider = {
  name: 'cms_nppes',
  type: 'professional_license',
  sourcePolicy: {
    sourceKind: 'public_record',
    production: true,
    termsUrl: TERMS_URL,
    licenseName: 'CMS NPPES NPI Registry public data',
    freshnessSeconds: 2_592_000,
    allowedPurposes: [
      'Healthcare provider identity research',
      'NPI lookup',
      'Reported professional-license identifier research',
      'Lawful consumer and investigator research',
    ],
    mayPersist: true,
    notes:
      'NPPES is an official healthcare-provider registry. License identifiers reported in NPPES are not treated as proof of current/active licensure; issuing-board verification remains required.',
  },

  async lookup(input: string): Promise<EnrichmentPayload> {
    let parsed: SearchInput
    try {
      parsed = JSON.parse(input) as SearchInput
    } catch {
      return {
        success: false,
        data: {},
        confidenceScore: 0,
        error: 'Invalid NPPES search input.',
      }
    }

    const npi = parsed.npi?.trim()
    const name = parsed.name?.trim()
    const state = parsed.state?.trim().toUpperCase()

    if (!npi && !name) {
      return {
        success: false,
        data: {},
        confidenceScore: 0,
        error: 'Provide an NPI or provider name.',
      }
    }

    if (npi && !/^\d{10}$/.test(npi)) {
      return {
        success: false,
        data: {},
        confidenceScore: 0,
        error: 'NPI must be exactly 10 digits.',
      }
    }

    try {
      let response: NppesResponse
      let sourceUrl: string

      if (npi) {
        const params = new URLSearchParams({ version: '2.1', number: npi })
        ;({ response, sourceUrl } = await fetchNppes(params))
      } else {
        const person = await fetchNppes(buildPersonParams(name!, state))
        response = person.response
        sourceUrl = person.sourceUrl

        if ((response.result_count ?? response.results?.length ?? 0) === 0) {
          const org = await fetchNppes(buildOrgParams(name!, state))
          response = org.response
          sourceUrl = org.sourceUrl
        }
      }

      const retrievedAt = new Date().toISOString()
      const rawResults = Array.isArray(response.results) ? response.results.slice(0, 20) : []
      const evidenceFacts: EvidenceFactInput[] = []

      const results = rawResults.map((item, index) => {
        const basic = asRecord(item.basic)
        const candidateNpi = str(item.number)
        const addresses = (Array.isArray(item.addresses) ? item.addresses : [])
          .map(asRecord)
          .filter((address): address is Record<string, unknown> => Boolean(address))
          .map(address => ({
            purpose: str(address.address_purpose),
            type: str(address.address_type),
            line1: str(address.address_1),
            line2: str(address.address_2),
            city: str(address.city),
            state: str(address.state),
            postalCode: str(address.postal_code),
            telephone: str(address.telephone_number),
          }))

        const taxonomies = (Array.isArray(item.taxonomies) ? item.taxonomies : [])
          .map(asRecord)
          .filter((taxonomy): taxonomy is Record<string, unknown> => Boolean(taxonomy))
          .map(taxonomy => ({
            code: str(taxonomy.code),
            description: str(taxonomy.desc),
            primary: bool(taxonomy.primary),
            state: str(taxonomy.state),
            license: str(taxonomy.license),
          }))

        const fullName = normalizeName(basic)
        const status = str(basic?.status)
        const credential = str(basic?.credential)
        const enumerationType = str(item.enumeration_type)
        const enumerationDate = str(basic?.enumeration_date)
        const lastUpdated = str(basic?.last_updated)

        const candidateFacts = [
          fact('professional.npi', candidateNpi, candidateNpi, retrievedAt, sourceUrl),
          fact('professional.name', fullName, candidateNpi, retrievedAt, sourceUrl),
          fact('professional.enumeration_type', enumerationType, candidateNpi, retrievedAt, sourceUrl),
          fact('professional.registry_status', status, candidateNpi, retrievedAt, sourceUrl),
          fact('professional.credential', credential, candidateNpi, retrievedAt, sourceUrl),
          fact('professional.enumeration_date', enumerationDate, candidateNpi, retrievedAt, sourceUrl),
          fact('professional.last_updated', lastUpdated, candidateNpi, retrievedAt, sourceUrl),
        ].filter((value): value is EvidenceFactInput => Boolean(value))

        for (const taxonomy of taxonomies) {
          if (taxonomy.description) {
            candidateFacts.push(fact(
              'professional.taxonomy',
              taxonomy.description,
              candidateNpi,
              retrievedAt,
              sourceUrl,
              0.98,
              { taxonomyCode: taxonomy.code, primary: taxonomy.primary }
            )!)
          }
          if (taxonomy.license) {
            candidateFacts.push(fact(
              'professional.reported_license_identifier',
              taxonomy.license,
              candidateNpi,
              retrievedAt,
              sourceUrl,
              0.9,
              {
                issuingState: taxonomy.state,
                taxonomyCode: taxonomy.code,
                activeStatusNotVerified: true,
              }
            )!)
          }
        }

        evidenceFacts.push(...candidateFacts.filter(Boolean))

        return {
          index,
          npi: candidateNpi,
          name: fullName,
          enumerationType,
          registryStatus: status,
          credential,
          enumerationDate,
          lastUpdated,
          addresses,
          taxonomies,
        }
      })

      return {
        success: true,
        data: {
          results,
          resultCount: results.length,
          limitation:
            'Healthcare-provider registry coverage only. NPPES-reported license identifiers are leads and do not establish current/active licensure; verify status with the issuing board.',
        },
        confidenceScore: npi && results.length === 1 ? 0.99 : results.length > 0 ? 0.92 : 0,
        evidenceFacts,
      }
    } catch (error) {
      return {
        success: false,
        data: {},
        confidenceScore: 0,
        error: error instanceof Error ? error.message : 'NPPES lookup failed.',
      }
    }
  },
}

registerProvider(nppesLicenseProvider)
