import type { EnrichmentProvider, EnrichmentPayload, WebSearchResult } from '@/types'
import { registerProvider } from './enrichment-provider'

interface BraveWebResult {
  title?: string
  url?: string
  description?: string
  profile?: {
    long_name?: string
  }
}

interface BraveSearchResponse {
  web?: {
    results?: BraveWebResult[]
  }
  query?: {
    original?: string
    more_results_available?: boolean
  }
}

const apiKey = process.env.BRAVE_SEARCH_API_KEY

const braveWebSearchProvider: EnrichmentProvider = {
  name: 'brave_web_search',
  type: 'web_search',
  sourcePolicy: {
    sourceKind: 'public_web',
    production: true,
    termsUrl: 'https://brave.com/terms-of-use/',
    licenseName: 'Brave Search API',
    freshnessSeconds: 0,
    allowedPurposes: [
      'public_web_research',
      'identity_verification',
      'case_research',
    ],
    mayPersist: true,
    notes:
      'Public-web discovery only. Search results are leads, not authoritative identity proof, and should be corroborated with additional sources.',
  },

  async lookup(query: string): Promise<EnrichmentPayload> {
    if (!apiKey) {
      return {
        success: false,
        data: {},
        confidenceScore: 0,
        error: 'Brave Search API credentials are not configured',
      }
    }

    const trimmed = query.trim()
    if (trimmed.length < 2) {
      return {
        success: false,
        data: {},
        confidenceScore: 0,
        error: 'Search query is too short',
      }
    }

    const endpoint = new URL('https://api.search.brave.com/res/v1/web/search')
    endpoint.searchParams.set('q', trimmed)
    endpoint.searchParams.set('count', '10')
    endpoint.searchParams.set('country', 'US')
    endpoint.searchParams.set('search_lang', 'en')
    endpoint.searchParams.set('safesearch', 'moderate')

    const response = await fetch(endpoint, {
      headers: {
        Accept: 'application/json',
        'X-Subscription-Token': apiKey,
      },
      cache: 'no-store',
    })

    const body = (await response.json()) as BraveSearchResponse & {
      error?: {
        code?: string
        detail?: string
      }
    }

    if (!response.ok) {
      return {
        success: false,
        data: {
          status: response.status,
          code: body.error?.code,
        },
        confidenceScore: 0,
        error: body.error?.detail || `Brave Search failed with HTTP ${response.status}`,
      }
    }

    const rawResults = body.web?.results ?? []
    const retrievedAt = new Date().toISOString()

    const results = rawResults
      .map((result, index) => {
        const url = result.url?.trim()
        if (!url) return null

        let source = result.profile?.long_name
        if (!source) {
          try {
            source = new URL(url).hostname.replace(/^www\./, '')
          } catch {
            source = 'web'
          }
        }

        return {
          title: result.title?.trim() || url,
          url,
          snippet: result.description?.trim() || '',
          source,
          rank: index + 1,
        }
      })
      .filter((result): result is NonNullable<typeof result> => Boolean(result))

    const payload: WebSearchResult = {
      results: results.map(({ title, url, snippet, source }) => ({
        title,
        url,
        snippet,
        source,
      })),
      totalResults: results.length,
    }

    const evidenceFacts = results.map((result, index) => ({
      field: `web.result.${index}`,
      value: {
        title: result.title,
        snippet: result.snippet,
        rank: result.rank,
      },
      sourceName: result.source,
      sourceUrl: result.url,
      retrievedAt,
      confidenceScore: Math.max(0.45, 0.78 - index * 0.035),
      metadata: {
        query: trimmed,
        provider: 'brave_web_search',
        authoritativeIdentityProof: false,
      },
    }))

    return {
      success: true,
      data: {
        ...payload,
        moreResultsAvailable: body.query?.more_results_available ?? false,
      } as unknown as Record<string, unknown>,
      confidenceScore: results.length ? 0.65 : 0.2,
      evidenceFacts,
    }
  },
}

if (apiKey) {
  registerProvider(braveWebSearchProvider)
}

export default braveWebSearchProvider
