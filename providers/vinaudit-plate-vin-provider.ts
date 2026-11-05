import type { EnrichmentPayload, EnrichmentProvider, EvidenceFactInput } from '@/types'
import { registerProvider } from './enrichment-provider'

const API_BASE = 'https://plate2vin.vinaudit.com/v1/licenselookup'
const TERMS_URL = 'https://data.vinaudit.com/terms'
const apiKey = process.env.VINAUDIT_API_KEY?.trim() || ''

const US_STATES = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC',
])

function parseInput(input: string) {
  const [stateRaw, ...plateParts] = input.split('|')
  const state = (stateRaw || '').trim().toUpperCase()
  const plate = plateParts.join('|').trim().toUpperCase()
  return { state, plate }
}

function evidence(
  field: string,
  value: unknown,
  state: string,
  retrievedAt: string,
): EvidenceFactInput | null {
  if (value === null || value === undefined || value === '') return null
  const normalized = typeof value === 'string' ? value.trim() : value
  return {
    field,
    value: normalized,
    normalizedValue: typeof normalized === 'string' ? normalized.toLowerCase() : undefined,
    sourceName: 'VinAudit Plate to VIN',
    sourceType: 'licensed_api',
    sourceUrl: 'https://data.vinaudit.com/plate-vin-api',
    sourceLocator: `US state:${state}`,
    legalBasis: 'Licensed VinAudit plate-to-VIN resolution data',
    retrievedAt,
    confidenceScore: 0.9,
    corroborationCount: 0,
    conflictCount: 0,
    metadata: {
      plateToVinResolution: true,
      ownershipIdentityEstablished: false,
      registrationIdentityEstablished: false,
    },
  }
}

const provider: EnrichmentProvider = {
  name: 'vinaudit_plate_to_vin',
  type: 'plate_to_vin',
  sourcePolicy: {
    sourceKind: 'licensed_api',
    production: Boolean(apiKey),
    termsUrl: TERMS_URL,
    licenseName: 'VinAudit Plate to VIN API',
    freshnessSeconds: 86_400,
    allowedPurposes: [
      'Vehicle identifier resolution',
      'Inventory and vehicle research',
      'Lawful consumer and investigator research',
    ],
    mayPersist: false,
    notes:
      'Resolves a U.S. plate and state to a VIN where provider data is available. This is not proof of ownership, current registration, residence, or person identity.',
  },

  async lookup(input: string): Promise<EnrichmentPayload> {
    const { state, plate } = parseInput(input)

    if (!US_STATES.has(state)) {
      return { success: false, data: {}, confidenceScore: 0, error: 'Use a valid two-letter U.S. state or DC code.' }
    }
    if (!plate || plate.length > 10 || !/^[A-Z0-9 -]+$/.test(plate)) {
      return { success: false, data: {}, confidenceScore: 0, error: 'Plate must be 1-10 letters, numbers, spaces, or hyphens.' }
    }
    if (!apiKey) {
      return { success: false, data: {}, confidenceScore: 0, error: 'VinAudit plate-to-VIN lookup is not configured.' }
    }

    const url = new URL(API_BASE)
    url.searchParams.set('key', apiKey)
    url.searchParams.set('plate', plate)
    url.searchParams.set('state', state)
    url.searchParams.set('format', 'json')

    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      })
      if (!response.ok) {
        return { success: false, data: {}, confidenceScore: 0, error: `VinAudit plate lookup returned HTTP ${response.status}.` }
      }

      const payload = await response.json() as { success?: boolean; vin?: string; VIN?: string; error?: string }
      const vin = (payload.vin || payload.VIN || '').trim().toUpperCase()
      if (!payload.success || !/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
        return {
          success: false,
          data: {},
          confidenceScore: 0,
          error: payload.error || 'No VIN was returned for that plate and state.',
        }
      }

      const retrievedAt = new Date().toISOString()
      const facts = [
        evidence('vehicle.vin', vin, state, retrievedAt),
        evidence('vehicle.plate_state', state, state, retrievedAt),
      ].filter((item): item is EvidenceFactInput => Boolean(item))

      return {
        success: true,
        data: {
          vin,
          state,
          limitation:
            'Plate-to-VIN resolution is a licensed vehicle-identifier lead. It does not establish ownership, registration status, address, or person identity.',
        },
        confidenceScore: 0.9,
        evidenceFacts: facts,
      }
    } catch (error) {
      return {
        success: false,
        data: {},
        confidenceScore: 0,
        error: error instanceof Error ? error.message : 'VinAudit plate-to-VIN lookup failed.',
      }
    }
  },
}

registerProvider(provider)
