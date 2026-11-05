import type { EnrichmentPayload, EnrichmentProvider, EvidenceFactInput } from '@/types'
import { registerProvider } from './enrichment-provider'

const API_BASE = 'https://api.gateway.attomdata.com/propertyapi/v1.0.0'
const TERMS_URL = 'https://api.developer.attomdata.com/docs'
const apiKey = process.env.ATTOM_API_KEY?.trim() || ''

type Row = Record<string, unknown>

function obj(value: unknown): Row | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Row : null
}

function path(value: unknown, ...parts: string[]): unknown {
  let current: unknown = value
  for (const part of parts) {
    const record = obj(current)
    if (!record) return undefined
    current = record[part]
  }
  return current
}

function str(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}

function num(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function money(value: unknown): number | null {
  const parsed = num(value)
  return parsed === null ? null : parsed
}

function propertyRows(payload: unknown): Row[] {
  const root = obj(payload)
  if (!root) return []
  const records = root.property
  return Array.isArray(records) ? records.map(obj).filter((row): row is Row => Boolean(row)) : []
}

function sourceUrl(attomId: string | null) {
  return attomId
    ? `https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/detailowner?id=${encodeURIComponent(attomId)}`
    : TERMS_URL
}

function fact(
  field: string,
  value: unknown,
  attomId: string | null,
  retrievedAt: string,
  confidenceScore = 0.88,
  metadata?: Record<string, unknown>,
): EvidenceFactInput | null {
  const normalized = typeof value === 'string' ? value.trim() : value
  if (normalized === null || normalized === undefined || normalized === '') return null
  return {
    field,
    value: normalized,
    normalizedValue: typeof normalized === 'string' ? normalized.toLowerCase() : undefined,
    sourceName: 'ATTOM Property API',
    sourceType: 'licensed_api',
    sourceUrl: sourceUrl(attomId),
    sourceLocator: attomId ? `ATTOM ID:${attomId}` : undefined,
    legalBasis: 'Licensed ATTOM property data derived in part from county public records',
    retrievedAt,
    confidenceScore,
    corroborationCount: 0,
    conflictCount: 0,
    metadata: {
      geographicCoverage: 'United States; county-level coverage varies',
      currentOwnershipNotEstablished: true,
      ...metadata,
    },
  }
}

async function lookupAddress(address: string): Promise<unknown> {
  if (!apiKey) throw new Error('ATTOM_API_KEY is not configured.')
  const url = new URL(`${API_BASE}/property/detailowner`)
  url.searchParams.set('address', address)

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      APIKey: apiKey,
    },
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`ATTOM returned HTTP ${response.status}.`)
  return response.json()
}

const attomPropertyProvider: EnrichmentProvider = {
  name: 'attom_property',
  type: 'property_record',
  sourcePolicy: {
    sourceKind: 'licensed_api',
    production: Boolean(apiKey),
    termsUrl: TERMS_URL,
    licenseName: 'ATTOM Property API',
    freshnessSeconds: 2_592_000,
    allowedPurposes: [
      'Property address research',
      'Property characteristics research',
      'Ownership-record lead research',
      'Lawful investigator and compliance research',
    ],
    mayPersist: true,
    notes:
      'Licensed U.S. property data with county-dependent coverage. Owner fields are record leads and must not be treated as conclusive current title or occupancy without corroboration.',
  },

  async lookup(input: string): Promise<EnrichmentPayload> {
    const address = input.trim()
    if (address.length < 5 || address.length > 220) {
      return { success: false, data: {}, confidenceScore: 0, error: 'Property address must be 5-220 characters.' }
    }
    if (!apiKey) {
      return { success: false, data: {}, confidenceScore: 0, error: 'ATTOM property search is not configured.' }
    }

    try {
      const payload = await lookupAddress(address)
      const retrievedAt = new Date().toISOString()
      const evidenceFacts: EvidenceFactInput[] = []

      const records = propertyRows(payload).slice(0, 20).map(row => {
        const attomId = str(path(row, 'identifier', 'attomId')) || str(path(row, 'identifier', 'Id'))
        const oneLine = str(path(row, 'address', 'oneLine'))
        const line1 = str(path(row, 'address', 'line1'))
        const line2 = str(path(row, 'address', 'line2'))
        const locality = str(path(row, 'address', 'locality'))
        const region = str(path(row, 'address', 'countrySubd'))
        const postalCode = str(path(row, 'address', 'postal1'))
        const owner1 = str(path(row, 'assessment', 'owner', 'owner1', 'fullName'))
          || str(path(row, 'owner', 'owner1', 'fullName'))
        const owner2 = str(path(row, 'assessment', 'owner', 'owner2', 'fullName'))
          || str(path(row, 'owner', 'owner2', 'fullName'))
        const propertyType = str(path(row, 'summary', 'propType'))
          || str(path(row, 'summary', 'propclass'))
        const yearBuilt = num(path(row, 'summary', 'yearbuilt'))
          || num(path(row, 'building', 'summary', 'yearBuilt'))
        const beds = num(path(row, 'building', 'rooms', 'beds'))
        const baths = num(path(row, 'building', 'rooms', 'bathsTotal'))
        const livingArea = num(path(row, 'building', 'size', 'livingSize'))
        const lotSize = num(path(row, 'lot', 'lotSize1'))
        const assessedValue = money(path(row, 'assessment', 'assessed', 'assdTtlValue'))
        const taxAmount = money(path(row, 'assessment', 'tax', 'taxAmt'))
        const taxYear = str(path(row, 'assessment', 'tax', 'taxYear'))
        const lastSaleAmount = money(path(row, 'sale', 'amount', 'saleAmt'))
        const lastSaleDate = str(path(row, 'sale', 'amount', 'saleSearchDate'))
          || str(path(row, 'sale', 'salesearchdate'))

        const facts = [
          fact('property.attom_id', attomId, attomId, retrievedAt, 0.98),
          fact('property.address', oneLine || [line1, line2].filter(Boolean).join(', '), attomId, retrievedAt, 0.94),
          fact('property.city', locality, attomId, retrievedAt, 0.92),
          fact('property.state', region, attomId, retrievedAt, 0.92),
          fact('property.postal_code', postalCode, attomId, retrievedAt, 0.92),
          fact('property.owner_name', owner1, attomId, retrievedAt, 0.82, { ownershipCurrentNotGuaranteed: true }),
          fact('property.owner_name', owner2, attomId, retrievedAt, 0.82, { ownershipCurrentNotGuaranteed: true }),
          fact('property.type', propertyType, attomId, retrievedAt, 0.9),
          fact('property.year_built', yearBuilt, attomId, retrievedAt, 0.9),
          fact('property.beds', beds, attomId, retrievedAt, 0.88),
          fact('property.baths', baths, attomId, retrievedAt, 0.88),
          fact('property.living_area', livingArea, attomId, retrievedAt, 0.88),
          fact('property.lot_size', lotSize, attomId, retrievedAt, 0.86),
          fact('property.assessed_value', assessedValue, attomId, retrievedAt, 0.86),
          fact('property.tax_amount', taxAmount, attomId, retrievedAt, 0.86),
          fact('property.tax_year', taxYear, attomId, retrievedAt, 0.86),
          fact('property.last_sale_amount', lastSaleAmount, attomId, retrievedAt, 0.84),
          fact('property.last_sale_date', lastSaleDate, attomId, retrievedAt, 0.84),
        ].filter((entry): entry is EvidenceFactInput => Boolean(entry))

        evidenceFacts.push(...facts)

        return {
          attomId,
          address: oneLine || [line1, line2].filter(Boolean).join(', ') || null,
          city: locality,
          state: region,
          postalCode,
          owners: [owner1, owner2].filter((value): value is string => Boolean(value)),
          propertyType,
          yearBuilt,
          beds,
          baths,
          livingArea,
          lotSize,
          assessedValue,
          taxAmount,
          taxYear,
          lastSaleAmount,
          lastSaleDate,
          sourceUrl: sourceUrl(attomId),
        }
      })

      return {
        success: true,
        data: {
          records,
          resultCount: records.length,
          coverage: 'Licensed ATTOM U.S. property data; county-level source coverage varies.',
          limitation:
            'ATTOM aggregates county public records and other licensed/proprietary data. Owner names are research leads, not conclusive proof of current title, residence, occupancy, debt, or legal interest. Confirm against current county recorder/assessor sources when material.',
        },
        confidenceScore: records.length ? 0.82 : 0,
        evidenceFacts,
      }
    } catch (error) {
      return {
        success: false,
        data: {},
        confidenceScore: 0,
        error: error instanceof Error ? error.message : 'ATTOM property lookup failed.',
      }
    }
  },
}

registerProvider(attomPropertyProvider)
