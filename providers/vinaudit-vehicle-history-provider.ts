import type { EnrichmentPayload, EnrichmentProvider, EvidenceFactInput } from '@/types'
import { registerProvider } from './enrichment-provider'

const API_BASE = 'https://api.vinaudit.com/v2/pullreport'
const TERMS_URL = 'https://data.vinaudit.com/terms'
const apiKey = process.env.VINAUDIT_API_KEY?.trim() || ''
const username = process.env.VINAUDIT_USERNAME?.trim() || ''
const password = process.env.VINAUDIT_PASSWORD?.trim() || ''
const reportId = process.env.VINAUDIT_REPORT_ID?.trim() || ''

type Row = Record<string, unknown>

function obj(value: unknown): Row | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Row : null
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function sourceUrl(vin: string) {
  return `https://data.vinaudit.com/vehicle-history-api#vin-${encodeURIComponent(vin)}`
}

function fact(
  field: string,
  value: unknown,
  vin: string,
  retrievedAt: string,
  confidenceScore = 0.9,
  metadata?: Record<string, unknown>,
): EvidenceFactInput | null {
  if (value === null || value === undefined || value === '') return null
  const normalized = typeof value === 'string' ? value.trim() : value
  return {
    field,
    value: normalized,
    normalizedValue: typeof normalized === 'string' ? normalized.toLowerCase() : undefined,
    sourceName: 'VinAudit Vehicle History',
    sourceType: 'licensed_api',
    sourceUrl: sourceUrl(vin),
    sourceLocator: `VIN:${vin}`,
    legalBasis: 'Licensed VinAudit vehicle-history data, including NMVTIS-backed records where returned',
    retrievedAt,
    confidenceScore,
    corroborationCount: 0,
    conflictCount: 0,
    metadata: {
      historyReport: true,
      nmvtisBacked: true,
      ...metadata,
    },
  }
}

function configured() {
  return Boolean(apiKey && username && password && reportId)
}

const provider: EnrichmentProvider = {
  name: 'vinaudit_vehicle_history',
  type: 'vehicle_history',
  sourcePolicy: {
    sourceKind: 'licensed_api',
    production: configured(),
    termsUrl: TERMS_URL,
    licenseName: 'VinAudit Vehicle History API',
    freshnessSeconds: 86_400,
    allowedPurposes: [
      'Vehicle-history research',
      'Title-brand and odometer research',
      'Salvage, theft, accident, and sale-record research',
      'Lawful consumer, investigator, and compliance research',
    ],
    mayPersist: true,
    notes:
      'Licensed vehicle-history data. Returned events are source records and research leads; absence of a record does not prove an event never occurred. Do not treat this as ownership identity verification.',
  },

  async lookup(input: string): Promise<EnrichmentPayload> {
    const vin = input.trim().toUpperCase()
    if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
      return { success: false, data: {}, confidenceScore: 0, error: 'VIN must be 17 characters and cannot contain I, O, or Q.' }
    }
    if (!configured()) {
      return { success: false, data: {}, confidenceScore: 0, error: 'VinAudit vehicle-history search is not configured.' }
    }

    const url = new URL(API_BASE)
    url.searchParams.set('id', reportId)
    url.searchParams.set('vin', vin)
    url.searchParams.set('user', username)
    url.searchParams.set('pass', password)
    url.searchParams.set('key', apiKey)
    url.searchParams.set('format', 'json')

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      })

      if (!response.ok) {
        return { success: false, data: {}, confidenceScore: 0, error: `VinAudit returned HTTP ${response.status}.` }
      }

      const payload = await response.json() as Row
      const success = payload.success === true || payload.success === 'true' || payload.success === 1
      const errors = str(payload.errors) || str(payload.error)

      if (!success) {
        return {
          success: false,
          data: {},
          confidenceScore: 0,
          error: errors || 'VinAudit returned no vehicle-history report.',
        }
      }

      const retrievedAt = new Date().toISOString()
      const attributes = obj(payload.attributes) || {}
      const titles = Array.isArray(payload.titles) ? payload.titles : []
      const checks = obj(payload.checks) || {}
      const events = Array.isArray(payload.events) ? payload.events : []

      const evidenceFacts: EvidenceFactInput[] = [
        fact('vehicle.vin', vin, vin, retrievedAt, 0.99),
        fact('vehicle.history_report_id', payload.id, vin, retrievedAt, 0.98),
        fact('vehicle.history_report_date', payload.date, vin, retrievedAt, 0.95),
        fact('vehicle.history.title_record_count', titles.length, vin, retrievedAt, 0.9),
        fact('vehicle.history.event_count', events.length, vin, retrievedAt, 0.86),
        fact('vehicle.history.make', attributes.make, vin, retrievedAt, 0.92),
        fact('vehicle.history.model', attributes.model, vin, retrievedAt, 0.92),
        fact('vehicle.history.year', attributes.year, vin, retrievedAt, 0.92),
      ].filter((entry): entry is EvidenceFactInput => Boolean(entry))

      for (const [key, value] of Object.entries(checks)) {
        if (value === null || value === undefined || value === '') continue
        const entry = fact(`vehicle.history.check.${key}`, value, vin, retrievedAt, 0.86)
        if (entry) evidenceFacts.push(entry)
      }

      return {
        success: true,
        data: {
          vin,
          reportId: str(payload.id),
          reportDate: str(payload.date),
          attributes,
          titles,
          checks,
          events,
          limitation:
            'Licensed vehicle-history records may be incomplete, delayed, or source-dependent. A missing event is not proof it never occurred. Confirm material title, lien, ownership, or legal-status questions with the appropriate current authority.',
        },
        confidenceScore: titles.length || Object.keys(checks).length ? 0.9 : 0.78,
        evidenceFacts,
      }
    } catch (error) {
      return {
        success: false,
        data: {},
        confidenceScore: 0,
        error: error instanceof Error ? error.message : 'VinAudit vehicle-history lookup failed.',
      }
    }
  },
}

registerProvider(provider)
