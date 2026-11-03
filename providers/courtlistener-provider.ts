import type { EnrichmentPayload, EnrichmentProvider, EvidenceFactInput } from '@/types'
import { registerProvider } from './enrichment-provider'

const API_URL = 'https://www.courtlistener.com/api/rest/v4/search/'
const TERMS_URL = 'https://www.courtlistener.com/help/api/rest/v4/'
const token = process.env.COURTLISTENER_API_TOKEN?.trim()

interface SearchResponse {
  count?: number
  results?: Array<Record<string, unknown>>
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function fact(field: string, value: unknown, locator: string, retrievedAt: string): EvidenceFactInput | null {
  const normalized = typeof value === 'string' ? value.trim() : value
  if (normalized === null || normalized === undefined || normalized === '') return null
  return {
    field,
    value: normalized,
    normalizedValue: typeof normalized === 'string' ? normalized.toLowerCase() : String(normalized),
    sourceName: 'CourtListener / RECAP',
    sourceType: 'public_record',
    sourceUrl: locator,
    sourceLocator: locator,
    legalBasis: 'Publicly accessible court record/reference research via Free Law Project CourtListener',
    retrievedAt,
    confidenceScore: 0.8,
    corroborationCount: 0,
    conflictCount: 0,
    metadata: {
      identityProof: false,
      requiresIndependentIdentityMatch: true,
      sourceSystem: 'CourtListener v4 Search API',
    },
  }
}

const provider: EnrichmentProvider = {
  name: 'courtlistener_search',
  type: 'court_record',
  sourcePolicy: {
    sourceKind: 'public_record',
    production: Boolean(token),
    termsUrl: TERMS_URL,
    licenseName: 'Free Law Project CourtListener / RECAP',
    freshnessSeconds: 0,
    allowedPurposes: [
      'Lawful court-record research',
      'Case and docket reference discovery',
      'Public-record verification',
    ],
    mayPersist: false,
    notes:
      'Court-name matches are leads only. A matching name does not establish identity, criminal history, liability, guilt, or disposition. Results must be independently matched using docket, court, dates, geography, and other identifiers.',
  },

  async lookup(input: string): Promise<EnrichmentPayload> {
    if (!token) {
      return { success: false, data: {}, confidenceScore: 0, error: 'CourtListener API token is not configured.' }
    }

    const query = input.trim()
    if (query.length < 2 || query.length > 200) {
      return { success: false, data: {}, confidenceScore: 0, error: 'Court search query must be 2-200 characters.' }
    }

    const url = new URL(API_URL)
    url.searchParams.set('q', query)
    url.searchParams.set('type', 'r')
    url.searchParams.set('order_by', 'score desc')

    const retrievedAt = new Date().toISOString()

    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          Authorization: `Token ${token}`,
          'User-Agent': 'AtlasVerify/1.0 court-record-research',
        },
        cache: 'no-store',
      })

      if (!response.ok) {
        return {
          success: false,
          data: {},
          confidenceScore: 0,
          error: `CourtListener returned HTTP ${response.status}.`,
        }
      }

      const body = await response.json() as SearchResponse
      const raw = Array.isArray(body.results) ? body.results.slice(0, 20) : []
      const results = raw.map((item, index) => {
        const absoluteUrl = str(item.absolute_url)
        const locator = absoluteUrl ? `https://www.courtlistener.com${absoluteUrl}` : 'https://www.courtlistener.com/'
        return {
          index,
          caseName: str(item.caseName) || str(item.caseNameFull),
          docketNumber: str(item.docketNumber),
          court: str(item.court),
          courtId: str(item.court_id),
          dateFiled: str(item.dateFiled),
          suitNature: str(item.suitNature),
          status: str(item.status),
          citation: Array.isArray(item.citation) ? item.citation.filter(v => typeof v === 'string').slice(0, 5) : [],
          url: locator,
          docketId: num(item.docket_id),
        }
      })

      const evidenceFacts = results.flatMap(result => [
        fact('court.case_name', result.caseName, result.url, retrievedAt),
        fact('court.docket_number', result.docketNumber, result.url, retrievedAt),
        fact('court.court', result.court, result.url, retrievedAt),
        fact('court.date_filed', result.dateFiled, result.url, retrievedAt),
      ]).filter((item): item is EvidenceFactInput => Boolean(item))

      return {
        success: true,
        data: {
          query,
          totalResults: typeof body.count === 'number' ? body.count : results.length,
          results,
          limitation:
            'Name/text search results are leads only and are not identity proof. Do not infer criminal history, guilt, liability, or disposition from a name match.',
        },
        confidenceScore: results.length > 0 ? 0.8 : 0.5,
        evidenceFacts,
      }
    } catch (error) {
      return {
        success: false,
        data: {},
        confidenceScore: 0,
        error: error instanceof Error ? error.message : 'CourtListener search failed.',
      }
    }
  },
}

if (token) registerProvider(provider)
