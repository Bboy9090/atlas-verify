import type { EnrichmentProvider, EnrichmentPayload, PhoneLookupResult } from '@/types'
import { registerProvider } from './enrichment-provider'

const mockPhoneProvider: EnrichmentProvider = {
  name: 'mock_phone_lookup',
  type: 'phone_lookup',
  sourcePolicy: {
    sourceKind: 'synthetic',
    production: false,
    allowedPurposes: ['development', 'testing', 'demo'],
    mayPersist: true,
    notes: 'Synthetic fixture provider. Must never be presented as real-world source coverage.'
  },
  
  async lookup(phoneNumber: string): Promise<EnrichmentPayload> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500))

    // Mock validation
    const cleanNumber = phoneNumber.replace(/\D/g, '')
    if (cleanNumber.length < 10) {
      return {
        success: false,
        data: {},
        confidenceScore: 0,
        error: 'Invalid phone number format'
      }
    }

    // Generate mock data based on phone number
    const mockData: PhoneLookupResult = {
      carrier: ['Verizon', 'AT&T', 'T-Mobile', 'Sprint'][Math.floor(Math.random() * 4)],
      lineType: ['mobile', 'landline', 'voip'][Math.floor(Math.random() * 3)],
      countryCode: '+1',
      nationalFormat: `(${cleanNumber.slice(0, 3)}) ${cleanNumber.slice(3, 6)}-${cleanNumber.slice(6, 10)}`,
      location: {
        city: ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix'][Math.floor(Math.random() * 5)],
        state: ['NY', 'CA', 'IL', 'TX', 'AZ'][Math.floor(Math.random() * 5)],
        country: 'US'
      }
    }

    const confidenceScore = 0.75 + Math.random() * 0.2
    const retrievedAt = new Date().toISOString()

    return {
      success: true,
      data: mockData as unknown as Record<string, unknown>,
      confidenceScore, // 0.75 - 0.95
      evidenceFacts: [
        {
          field: 'phone.carrier',
          value: mockData.carrier,
          sourceName: 'mock_phone_lookup',
          retrievedAt,
          confidenceScore,
          metadata: { synthetic: true }
        },
        {
          field: 'phone.lineType',
          value: mockData.lineType,
          sourceName: 'mock_phone_lookup',
          retrievedAt,
          confidenceScore,
          metadata: { synthetic: true }
        },
        {
          field: 'phone.location',
          value: mockData.location,
          sourceName: 'mock_phone_lookup',
          retrievedAt,
          confidenceScore,
          metadata: { synthetic: true }
        }
      ]
    }
  }
}

// Register on import
registerProvider(mockPhoneProvider)

export default mockPhoneProvider
