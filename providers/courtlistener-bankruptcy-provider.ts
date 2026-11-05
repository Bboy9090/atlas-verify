import type { EnrichmentPayload, EnrichmentProvider, EvidenceFactInput } from '@/types'
import { registerProvider } from './enrichment-provider'

const API_URL = 'https://www.courtlistener.com/api/rest/v4/search/'
const TERMS_URL = 'https://www.courtlistener.com/help/api/rest/v4/'
const token = process.env.COURTLISTENER_API_TOKEN?.trim()

// CourtListener's documented bankruptcy-jurisdiction set for RECAP searches.
// Keep this explicit so a generic district/civil/criminal hit cannot be
// mislabeled as a bankruptcy reference.
const BANKRUPTCY_COURTS = [
  'almb','alnb','alsb','akb','arb','areb','arwb','cacb','caeb','canb','casb','cob','ctb','deb','dcb',
  'flmb','flnb','flsb','gamb','ganb','gasb','hib','idb','ilcb','ilnb','ilsb','innb','insb','ianb','iasb',
  'ksb','kyeb','kywb','laeb','lamb','lawb','meb','mdb','mab','mieb','miwb','mnb','msnb','mssb','moeb',
  'mowb','mtb','nebraskab','nvb','nhb','njb','nmb','nyeb','nynb','nysb','nywb','nceb','ncmb','ncwb',
  'ndb','ohnb','ohsb','okeb','oknb','okwb','orb','paeb','pamb','pawb','rib','scb','sdb','tneb','tnmb',
  'tnwb','txeb','txnb','txsb','txwb','utb','vtb','vaeb','vawb','waeb','wawb','wvnb','wvsb','wieb',
  'wiwb','wyb','gub','nmib','prb','vib',
].join(' ')

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
    sourceName: 'CourtListener / RECAP Bankruptcy',
    sourceType: 'public_record',
    sourceUrl: locator,
    sourceLocator: locator,
    legalBasis: 'Public federal bankruptcy reference research via CourtListener / RECAP',
    retrievedAt,
    confidenceScore: 0.82,
    corroborationCount: 0,
    conflictCount: 0,
    metadata: {
      bankruptcyReference: true,
      identityProof: false,
      debtStatusProof: false,
      requiresIndependentIdentityMatch: true,
      sourceSystem: 'CourtListener v4 Search API',
    },
  }
}

const provider: EnrichmentProvider = {
  name: 'courtlistener_bankruptcy',
  type: 'court_record',
  sourcePolicy: {
    sourceKind: 'public_record',
    production: Boolean(token),
    termsUrl: TERMS_URL,
    licenseName: 'Free Law Project CourtListener / RECAP',
    freshnessSeconds: 0,
    allowedPurposes: [
      'Lawful federal bankruptcy reference research',
      'Bankruptcy docket discovery',
      'Public-record verification',
    ],
    mayPersist: false,
    notes:
      'Bankruptcy name/text matches are leads only. A hit does not establish that the searched person is the debtor, that a debt remains due, or any present financial condition. Independently match court, docket, dates, geography, and other identifiers.',
  },

  async lookup(input: string): Promise<EnrichmentPayload> {
    if (!token) {
      return { success: false, data: {}, confidenceScore: 0, error: 'CourtListener API token is not configured.' }
    }

    const query = input.trim()
    if (query.length < 2 || query.length > 200) {
      return { success: false, data: {}, confidenceScore: 0, error: 'Bankruptcy search query must be 2-200 characters.' }
    }

    const url = new URL(API_URL)
    url.searchParams.set('q', query)
    url.searchParams.set('type', 'd')
    url.searchParams.set('court', BANKRUPTCY_COURTS)
    url.searchParams.set('order_by', 'score desc')

    const retrievedAt = new Date().toISOString()

    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          Authorization: `Token ${token}`,
          'User-Agent': 'AtlasVerify/1.0 bankruptcy-reference-research',
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
        const locator = absoluteUrl
          ? `https://www.courtlistener.com${absoluteUrl}`
          : 'https://www.courtlistener.com/'
        const bankruptcy = item.bankruptcy_information && typeof item.bankruptcy_information === 'object'
          ? item.bankruptcy_information as Record<string, unknown>
          : null

        return {
          index,
          caseName: str(item.caseName) || str(item.caseNameFull),
          docketNumber: str(item.docketNumber),
          court: str(item.court),
          courtId: str(item.court_id),
          dateFiled: str(item.dateFiled),
          dateTerminated: str(item.dateTerminated),
          chapter: str(bankruptcy?.chapter) || str(item.bankruptcyChapter),
          trustee: str(bankruptcy?.trustee) || str(bankruptcy?.trustee_name),
          url: locator,
          docketId: num(item.docket_id) ?? num(item.id),
        }
      })

      const evidenceFacts = results.flatMap(result => [
        fact('bankruptcy.case_name', result.caseName, result.url, retrievedAt),
        fact('bankruptcy.docket_number', result.docketNumber, result.url, retrievedAt),
        fact('bankruptcy.court', result.court, result.url, retrievedAt),
        fact('bankruptcy.date_filed', result.dateFiled, result.url, retrievedAt),
        fact('bankruptcy.date_terminated', result.dateTerminated, result.url, retrievedAt),
        fact('bankruptcy.chapter', result.chapter, result.url, retrievedAt),
      ]).filter((item): item is EvidenceFactInput => Boolean(item))

      return {
        success: true,
        data: {
          query,
          totalResults: typeof body.count === 'number' ? body.count : results.length,
          results,
          limitation:
            'Federal bankruptcy references are public-record leads only. A name match is not identity proof and does not establish current debt, creditworthiness, financial condition, liability, or eligibility for any decision.',
        },
        confidenceScore: results.length > 0 ? 0.82 : 0.5,
        evidenceFacts,
      }
    } catch (error) {
      return {
        success: false,
        data: {},
        confidenceScore: 0,
        error: error instanceof Error ? error.message : 'CourtListener bankruptcy search failed.',
      }
    }
  },
}

if (token) registerProvider(provider)
