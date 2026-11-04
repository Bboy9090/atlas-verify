import type { EnrichmentProvider, EnrichmentPayload } from '@/types'
import { registerProvider } from './enrichment-provider'

interface BraveProfileResult {
  title?: string
  url?: string
  description?: string
  profile?: { long_name?: string }
}

interface BraveProfileResponse {
  web?: { results?: BraveProfileResult[] }
}

const apiKey = process.env.BRAVE_SEARCH_API_KEY
const PROFILE_HOSTS = [
  'github.com',
  'linkedin.com',
  'instagram.com',
  'x.com',
  'twitter.com',
  'facebook.com',
  'tiktok.com',
  'youtube.com',
  'reddit.com',
] as const

function normalizeHandle(input: string) {
  return input.trim().replace(/^@+/, '').replace(/\s+/g, '')
}

function hostFor(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return ''
  }
}

const publicProfileProvider: EnrichmentProvider = {
  name: 'brave_public_profile_search',
  type: 'profile_search',
  sourcePolicy: {
    sourceKind: 'public_web',
    production: true,
    termsUrl: 'https://brave.com/terms-of-use/',
    licenseName: 'Brave Search API',
    freshnessSeconds: 0,
    allowedPurposes: [
      'public_profile_research',
      'username_research',
      'identity_verification',
      'case_research',
    ],
    mayPersist: false,
    notes:
      'Public profile discovery only. A matching handle or name is a lead and is never treated as confirmed identity without independent corroboration.',
  },

  async lookup(input: string): Promise<EnrichmentPayload> {
    if (!apiKey) {
      return {
        success: false,
        data: {},
        confidenceScore: 0,
        error: 'Brave Search API credentials are not configured',
      }
    }

    const handle = normalizeHandle(input)
    if (handle.length < 2 || handle.length > 80) {
      return {
        success: false,
        data: {},
        confidenceScore: 0,
        error: 'Username must be between 2 and 80 characters',
      }
    }

    const siteQuery = PROFILE_HOSTS.map(host => `site:${host}`).join(' OR ')
    const endpoint = new URL('https://api.search.brave.com/res/v1/web/search')
    endpoint.searchParams.set('q', `"${handle}" (${siteQuery})`)
    endpoint.searchParams.set('count', '20')
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

    const body = (await response.json()) as BraveProfileResponse & {
      error?: { detail?: string; code?: string }
    }

    if (!response.ok) {
      return {
        success: false,
        data: { status: response.status, code: body.error?.code },
        confidenceScore: 0,
        error: body.error?.detail || `Profile search failed with HTTP ${response.status}`,
      }
    }

    const retrievedAt = new Date().toISOString()
    const seen = new Set<string>()
    const results = (body.web?.results || [])
      .map((result, index) => {
        const url = result.url?.trim() || ''
        const host = hostFor(url)
        if (!url || !PROFILE_HOSTS.some(allowed => host === allowed || host.endsWith(`.${allowed}`))) return null
        if (seen.has(url)) return null
        seen.add(url)

        const text = `${result.title || ''} ${result.description || ''} ${url}`.toLowerCase()
        const normalizedHandle = handle.toLowerCase()
        const exactHandleSignal =
          text.includes(`@${normalizedHandle}`) ||
          url.toLowerCase().includes(`/${normalizedHandle}`) ||
          url.toLowerCase().includes(`=${normalizedHandle}`)
        const confidence = exactHandleSignal
          ? Math.max(0.58, 0.82 - index * 0.02)
          : Math.max(0.35, 0.58 - index * 0.015)

        return {
          platform: host,
          title: result.title?.trim() || url,
          url,
          snippet: result.description?.trim() || '',
          rank: index + 1,
          exactHandleSignal,
          confidence,
        }
      })
      .filter((result): result is NonNullable<typeof result> => Boolean(result))
      .slice(0, 20)

    return {
      success: true,
      data: {
        handle,
        results,
        totalResults: results.length,
        identityConfirmed: false,
        limitation:
          'Public profile leads only. Matching usernames can belong to different people and require independent corroboration.',
      },
      confidenceScore: results.length ? Math.max(...results.map(result => result.confidence)) : 0.2,
      evidenceFacts: results.map((result, index) => ({
        field: `profile.result.${index}`,
        value: {
          platform: result.platform,
          title: result.title,
          snippet: result.snippet,
          exactHandleSignal: result.exactHandleSignal,
          rank: result.rank,
        },
        sourceName: result.platform,
        sourceType: 'public_web',
        sourceUrl: result.url,
        retrievedAt,
        confidenceScore: result.confidence,
        metadata: {
          provider: 'brave_public_profile_search',
          queryHandle: handle,
          identityConfirmed: false,
          leadOnly: true,
        },
      })),
    }
  },
}

if (apiKey) {
  registerProvider(publicProfileProvider)
}

export default publicProfileProvider
