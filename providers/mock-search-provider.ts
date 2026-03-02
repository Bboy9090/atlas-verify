import type { EnrichmentProvider, EnrichmentPayload, WebSearchResult } from '@/types'
import { registerProvider } from './enrichment-provider'

const mockSearchProvider: EnrichmentProvider = {
  name: 'mock_web_search',
  type: 'web_search',
  
  async lookup(query: string): Promise<EnrichmentPayload> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800))

    if (!query || query.trim().length < 2) {
      return {
        success: false,
        data: {},
        confidenceScore: 0,
        error: 'Query too short'
      }
    }

    // Generate mock search results
    const mockResults: WebSearchResult = {
      results: [
        {
          title: `Professional Profile - ${query}`,
          url: `https://linkedin.com/in/${query.toLowerCase().replace(/\s/g, '-')}`,
          snippet: `View ${query}'s professional profile on LinkedIn. See their experience, education, and connections.`,
          source: 'linkedin.com'
        },
        {
          title: `${query} - Public Records`,
          url: `https://publicrecords.example.com/search?q=${encodeURIComponent(query)}`,
          snippet: `Public records found for ${query}. Includes address history, phone numbers, and related information.`,
          source: 'publicrecords.example.com'
        },
        {
          title: `News mentions: ${query}`,
          url: `https://news.example.com/search?q=${encodeURIComponent(query)}`,
          snippet: `Recent news articles mentioning ${query}. Stay updated with the latest coverage.`,
          source: 'news.example.com'
        }
      ],
      totalResults: 3
    }

    return {
      success: true,
      data: mockResults as unknown as Record<string, unknown>,
      confidenceScore: 0.6 + Math.random() * 0.3 // 0.6 - 0.9
    }
  }
}

// Register on import
registerProvider(mockSearchProvider)

export default mockSearchProvider
