import type { EnrichmentPayload, EnrichmentProvider, EvidenceFactInput } from '@/types'
import { registerProvider } from './enrichment-provider'

const SEC_TICKERS_URL = 'https://www.sec.gov/files/company_tickers.json'
const SEC_SUBMISSIONS_BASE = 'https://data.sec.gov/submissions'
const SEC_TERMS_URL = 'https://www.sec.gov/about/developer-resources'
const secUserAgent = process.env.SEC_USER_AGENT?.trim() || ''

interface SecTickerEntry {
  cik_str?: number | string
  ticker?: string
  title?: string
}

interface SecTickerIndex {
  [key: string]: SecTickerEntry
}

interface SecSubmissions {
  cik?: string
  entityType?: string
  sic?: string
  sicDescription?: string
  ownerOrg?: string
  insiderTransactionForOwnerExists?: number
  insiderTransactionForIssuerExists?: number
  name?: string
  tickers?: string[]
  exchanges?: string[]
  ein?: string
  description?: string
  website?: string
  investorWebsite?: string
  category?: string
  fiscalYearEnd?: string
  stateOfIncorporation?: string
  stateOfIncorporationDescription?: string
  phone?: string
  flags?: string
  addresses?: {
    mailing?: Record<string, unknown>
    business?: Record<string, unknown>
  }
  formerNames?: Array<Record<string, unknown>>
  filings?: {
    recent?: {
      accessionNumber?: string[]
      filingDate?: string[]
      reportDate?: string[]
      acceptanceDateTime?: string[]
      act?: string[]
      form?: string[]
      fileNumber?: string[]
      filmNumber?: string[]
      items?: string[]
      size?: number[]
      isXBRL?: number[]
      isInlineXBRL?: number[]
      primaryDocument?: string[]
      primaryDocDescription?: string[]
    }
  }
}

function str(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}

function normalizeCik(value: unknown): string | null {
  const raw = str(value)
  if (!raw || !/^\d+$/.test(raw)) return null
  return raw.padStart(10, '0')
}

function fact(
  field: string,
  value: unknown,
  cik: string,
  retrievedAt: string,
  sourceUrl: string,
  metadata?: Record<string, unknown>
): EvidenceFactInput | null {
  const normalized = typeof value === 'string' ? value.trim() : value
  if (normalized === null || normalized === undefined || normalized === '') return null
  return {
    field,
    value: normalized,
    normalizedValue: typeof normalized === 'string' ? normalized.toLowerCase() : undefined,
    sourceName: 'SEC EDGAR',
    sourceType: 'public_record',
    sourceUrl,
    sourceLocator: `CIK:${cik}`,
    legalBasis: 'Public SEC EDGAR filing and submissions data',
    retrievedAt,
    confidenceScore: 0.99,
    corroborationCount: 0,
    conflictCount: 0,
    metadata: {
      registry: 'SEC EDGAR',
      publicCompanyOrFilerCoverage: true,
      privateCompanyUniversalCoverage: false,
      ...metadata,
    },
  }
}

function address(value: unknown) {
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
  if (!record) return null
  const result = {
    street1: str(record.street1),
    street2: str(record.street2),
    city: str(record.city),
    stateOrCountry: str(record.stateOrCountry),
    zipCode: str(record.zipCode),
    stateOrCountryDescription: str(record.stateOrCountryDescription),
  }
  return Object.values(result).some(Boolean) ? result : null
}

async function secFetchJson<T>(url: string): Promise<T> {
  if (!secUserAgent) {
    throw new Error('SEC_USER_AGENT is not configured. SEC automated access remains disabled.')
  }

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': secUserAgent,
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`SEC EDGAR returned HTTP ${response.status}.`)
  }

  return response.json() as Promise<T>
}

function scoreEntry(entry: SecTickerEntry, query: string) {
  const q = query.toLowerCase()
  const ticker = str(entry.ticker)?.toLowerCase() || ''
  const title = str(entry.title)?.toLowerCase() || ''
  const cik = normalizeCik(entry.cik_str) || ''
  const numericQuery = /^\d+$/.test(query) ? query.padStart(10, '0') : ''

  if (numericQuery && cik === numericQuery) return 100
  if (ticker === q) return 95
  if (title === q) return 90
  if (title.startsWith(q)) return 80
  if (ticker.startsWith(q)) return 70
  if (title.includes(q)) return 60
  return 0
}

const secBusinessProvider: EnrichmentProvider = {
  name: 'sec_edgar',
  type: 'business_entity',
  sourcePolicy: {
    sourceKind: 'public_record',
    production: Boolean(secUserAgent),
    termsUrl: SEC_TERMS_URL,
    licenseName: 'U.S. Securities and Exchange Commission EDGAR public data',
    freshnessSeconds: 86_400,
    allowedPurposes: [
      'Public-company and SEC-filer research',
      'Business/entity identity research',
      'Public filing research',
      'Lawful consumer and investigator research',
    ],
    mayPersist: true,
    notes:
      'SEC EDGAR covers SEC filers and public-company filing data, not every U.S. business or private company. Automated access is disabled unless SEC_USER_AGENT is configured.',
  },

  async lookup(input: string): Promise<EnrichmentPayload> {
    const query = input.trim()
    if (query.length < 2) {
      return {
        success: false,
        data: {},
        confidenceScore: 0,
        error: 'Business search query must be at least 2 characters.',
      }
    }

    if (!secUserAgent) {
      return {
        success: false,
        data: {},
        confidenceScore: 0,
        error: 'SEC business search is not configured because SEC_USER_AGENT is missing.',
      }
    }

    try {
      const tickerIndex = await secFetchJson<SecTickerIndex>(SEC_TICKERS_URL)
      const matches = Object.values(tickerIndex)
        .map(entry => ({ entry, score: scoreEntry(entry, query) }))
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 8)

      const retrievedAt = new Date().toISOString()
      const evidenceFacts: EvidenceFactInput[] = []
      const entities = []

      for (const match of matches.slice(0, 5)) {
        const cik = normalizeCik(match.entry.cik_str)
        if (!cik) continue

        const sourceUrl = `${SEC_SUBMISSIONS_BASE}/CIK${cik}.json`
        const submissions = await secFetchJson<SecSubmissions>(sourceUrl)
        const recent = submissions.filings?.recent
        const recentFilings = (recent?.accessionNumber || []).slice(0, 12).map((accessionNumber, index) => ({
          accessionNumber,
          filingDate: recent?.filingDate?.[index] || null,
          reportDate: recent?.reportDate?.[index] || null,
          form: recent?.form?.[index] || null,
          primaryDocument: recent?.primaryDocument?.[index] || null,
          primaryDocDescription: recent?.primaryDocDescription?.[index] || null,
        }))

        const formerNames = (submissions.formerNames || [])
          .map(item => ({
            name: str(item.name),
            from: str(item.from),
            to: str(item.to),
          }))
          .filter(item => item.name)

        const entityName = str(submissions.name) || str(match.entry.title)
        const ticker = submissions.tickers?.[0] || str(match.entry.ticker)
        const facts = [
          fact('business.cik', cik, cik, retrievedAt, sourceUrl),
          fact('business.name', entityName, cik, retrievedAt, sourceUrl),
          fact('business.ticker', ticker, cik, retrievedAt, sourceUrl),
          fact('business.entity_type', submissions.entityType, cik, retrievedAt, sourceUrl),
          fact('business.sic', submissions.sic, cik, retrievedAt, sourceUrl),
          fact('business.sic_description', submissions.sicDescription, cik, retrievedAt, sourceUrl),
          fact('business.state_of_incorporation', submissions.stateOfIncorporation, cik, retrievedAt, sourceUrl),
          fact('business.fiscal_year_end', submissions.fiscalYearEnd, cik, retrievedAt, sourceUrl),
          fact('business.phone', submissions.phone, cik, retrievedAt, sourceUrl),
        ].filter((value): value is EvidenceFactInput => Boolean(value))

        for (const former of formerNames) {
          facts.push(fact(
            'business.former_name',
            former.name,
            cik,
            retrievedAt,
            sourceUrl,
            { from: former.from, to: former.to }
          )!)
        }

        for (const filing of recentFilings) {
          if (!filing.form || !filing.accessionNumber) continue
          facts.push(fact(
            'business.recent_filing',
            `${filing.form} ${filing.filingDate || ''}`.trim(),
            cik,
            retrievedAt,
            sourceUrl,
            {
              accessionNumber: filing.accessionNumber,
              filingDate: filing.filingDate,
              reportDate: filing.reportDate,
              primaryDocument: filing.primaryDocument,
            }
          )!)
        }

        evidenceFacts.push(...facts.filter(Boolean))

        entities.push({
          cik,
          name: entityName,
          ticker,
          tickers: submissions.tickers || [],
          exchanges: submissions.exchanges || [],
          entityType: str(submissions.entityType),
          sic: str(submissions.sic),
          sicDescription: str(submissions.sicDescription),
          stateOfIncorporation: str(submissions.stateOfIncorporation),
          stateOfIncorporationDescription: str(submissions.stateOfIncorporationDescription),
          fiscalYearEnd: str(submissions.fiscalYearEnd),
          ein: str(submissions.ein),
          phone: str(submissions.phone),
          website: str(submissions.website),
          investorWebsite: str(submissions.investorWebsite),
          category: str(submissions.category),
          businessAddress: address(submissions.addresses?.business),
          mailingAddress: address(submissions.addresses?.mailing),
          formerNames,
          recentFilings,
          matchScore: match.score / 100,
          sourceUrl,
        })
      }

      return {
        success: true,
        data: {
          entities,
          resultCount: entities.length,
          limitation:
            'SEC EDGAR covers SEC filers and public-company filing records. It is not a universal U.S. business registry and should not be presented as private-company coverage.',
        },
        confidenceScore: entities[0]?.matchScore ?? 0,
        evidenceFacts,
      }
    } catch (error) {
      return {
        success: false,
        data: {},
        confidenceScore: 0,
        error: error instanceof Error ? error.message : 'SEC EDGAR lookup failed.',
      }
    }
  },
}

registerProvider(secBusinessProvider)
