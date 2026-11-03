import type { EnrichmentPayload, EnrichmentProvider, EvidenceFactInput } from '@/types'
import { registerProvider } from './enrichment-provider'

const PARTIES_URL = 'https://data.cityofnewyork.us/resource/636b-3b5g.json'
const MASTER_URL = 'https://data.cityofnewyork.us/resource/bnx9-e6tj.json'
const LEGALS_URL = 'https://data.cityofnewyork.us/resource/8h5j-fqxa.json'
const TERMS_URL = 'https://opendata.cityofnewyork.us/overview/'

type Row = Record<string, unknown>

interface SearchInput {
  query: string
  mode: 'name' | 'address'
}

const BOROUGH: Record<string, string> = {
  '1': 'Manhattan',
  '2': 'Bronx',
  '3': 'Brooklyn',
  '4': 'Queens',
  '5': 'Staten Island',
}

const PARTY_ROLE: Record<string, string> = {
  '1': 'grantor / seller / mortgagor / debtor',
  '2': 'grantee / buyer / mortgagee / creditor',
  '3': 'other party',
}

function str(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}

function soqlLiteral(value: string) {
  return value.replace(/'/g, "''")
}

function docImageUrl(documentId: string) {
  return `https://a836-acris.nyc.gov/DS/DocumentSearch/DocumentImageView?doc_id=${encodeURIComponent(documentId)}`
}

async function fetchRows(url: string, params: URLSearchParams): Promise<Row[]> {
  const response = await fetch(`${url}?${params.toString()}`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'AtlasVerify/1.0 (+https://github.com/Bboy9090/atlas-verify)',
    },
    cache: 'no-store',
  })
  if (!response.ok) {
    throw new Error(`NYC Open Data returned HTTP ${response.status}.`)
  }
  const payload = await response.json()
  return Array.isArray(payload) ? payload as Row[] : []
}

function inClause(ids: string[]) {
  return ids.map(id => `'${soqlLiteral(id)}'`).join(',')
}

async function fetchByDocumentIds(url: string, documentIds: string[], limit = 250) {
  if (documentIds.length === 0) return [] as Row[]
  const rows: Row[] = []
  for (let i = 0; i < documentIds.length; i += 50) {
    const chunk = documentIds.slice(i, i + 50)
    const params = new URLSearchParams({
      '$where': `document_id in (${inClause(chunk)})`,
      '$limit': String(limit),
    })
    rows.push(...await fetchRows(url, params))
  }
  return rows
}

function parseAddressQuery(query: string) {
  const normalized = query.trim().replace(/\s+/g, ' ')
  const match = normalized.match(/^([0-9]+(?:-[0-9]+)?)\s+(.+)$/)
  if (!match) return { streetNumber: null, streetName: normalized }
  return { streetNumber: match[1], streetName: match[2] }
}

function partyFromRow(row: Row) {
  const partyType = str(row.party_type)
  return {
    name: str(row.name),
    partyType,
    partyRole: partyType ? PARTY_ROLE[partyType] || 'recorded party' : 'recorded party',
    address1: str(row.address_1),
    address2: str(row.address_2),
    city: str(row.city),
    state: str(row.state),
    zip: str(row.zip),
    country: str(row.country),
  }
}

function legalFromRow(row: Row) {
  const boroughCode = str(row.borough)
  return {
    boroughCode,
    borough: boroughCode ? BOROUGH[boroughCode] || boroughCode : null,
    block: str(row.block),
    lot: str(row.lot),
    streetNumber: str(row.street_number),
    streetName: str(row.street_name),
    unit: str(row.unit) || str(row.addr_unit),
    propertyType: str(row.property_type),
    partialLot: str(row.partial_lot),
    airRights: str(row.air_rights),
    subterraneanRights: str(row.subterranean_rights),
  }
}

function fact(
  field: string,
  value: unknown,
  documentId: string,
  retrievedAt: string,
  metadata?: Record<string, unknown>,
  confidenceScore = 0.96
): EvidenceFactInput | null {
  const normalized = typeof value === 'string' ? value.trim() : value
  if (normalized === null || normalized === undefined || normalized === '') return null

  return {
    field,
    value: normalized,
    normalizedValue: typeof normalized === 'string' ? normalized.toLowerCase() : undefined,
    sourceName: 'NYC DOF ACRIS',
    sourceType: 'public_record',
    sourceUrl: docImageUrl(documentId),
    sourceLocator: `ACRIS document:${documentId}`,
    legalBasis: 'Public NYC Department of Finance ACRIS recorded-property data',
    retrievedAt,
    confidenceScore,
    corroborationCount: 0,
    conflictCount: 0,
    metadata: {
      geographicCoverage: 'New York City',
      currentOwnershipNotEstablished: true,
      ...metadata,
    },
  }
}

const nycAcrisPropertyProvider: EnrichmentProvider = {
  name: 'nyc_acris_property',
  type: 'property_record',
  sourcePolicy: {
    sourceKind: 'public_record',
    production: true,
    termsUrl: TERMS_URL,
    licenseName: 'NYC Department of Finance ACRIS / NYC Open Data',
    freshnessSeconds: 2_592_000,
    allowedPurposes: [
      'NYC recorded-property research',
      'Deed and mortgage document research',
      'Recorded party and property-history research',
      'Lawful consumer and investigator research',
    ],
    mayPersist: true,
    notes:
      'NYC-only recorded instrument data. A party on an ACRIS document is not automatically the current owner. AtlasVerify must preserve document date, role, and source provenance.',
  },

  async lookup(input: string): Promise<EnrichmentPayload> {
    let parsed: SearchInput
    try {
      parsed = JSON.parse(input) as SearchInput
    } catch {
      return { success: false, data: {}, confidenceScore: 0, error: 'Invalid ACRIS search input.' }
    }

    const query = parsed.query?.trim()
    const mode = parsed.mode

    if (!query || query.length < 2 || query.length > 160) {
      return { success: false, data: {}, confidenceScore: 0, error: 'Property query must be 2-160 characters.' }
    }
    if (mode !== 'name' && mode !== 'address') {
      return { success: false, data: {}, confidenceScore: 0, error: 'Unsupported ACRIS search mode.' }
    }

    try {
      let parties: Row[] = []
      let legals: Row[] = []

      if (mode === 'name') {
        const params = new URLSearchParams({
          '$where': `upper(name) like '%${soqlLiteral(query.toUpperCase())}%'`,
          '$limit': '25',
          '$order': 'document_id DESC',
        })
        parties = await fetchRows(PARTIES_URL, params)
        const ids = Array.from(new Set(parties.map(row => str(row.document_id)).filter((id): id is string => Boolean(id))))
        legals = await fetchByDocumentIds(LEGALS_URL, ids)
      } else {
        const { streetNumber, streetName } = parseAddressQuery(query)
        const where = [
          `upper(street_name) like '%${soqlLiteral(streetName.toUpperCase())}%'`,
          streetNumber ? `street_number='${soqlLiteral(streetNumber)}'` : null,
        ].filter(Boolean).join(' AND ')
        const params = new URLSearchParams({
          '$where': where,
          '$limit': '25',
          '$order': 'document_id DESC',
        })
        legals = await fetchRows(LEGALS_URL, params)
        const ids = Array.from(new Set(legals.map(row => str(row.document_id)).filter((id): id is string => Boolean(id))))
        parties = await fetchByDocumentIds(PARTIES_URL, ids)
      }

      const documentIds = Array.from(new Set(
        [...parties, ...legals]
          .map(row => str(row.document_id))
          .filter((id): id is string => Boolean(id))
      )).slice(0, 50)

      const masters = await fetchByDocumentIds(MASTER_URL, documentIds, 100)
      const masterById = new Map(masters.map(row => [str(row.document_id), row] as const).filter(([id]) => Boolean(id)))
      const partiesById = new Map<string, Row[]>()
      const legalsById = new Map<string, Row[]>()

      for (const row of parties) {
        const id = str(row.document_id)
        if (!id) continue
        partiesById.set(id, [...(partiesById.get(id) || []), row])
      }
      for (const row of legals) {
        const id = str(row.document_id)
        if (!id) continue
        legalsById.set(id, [...(legalsById.get(id) || []), row])
      }

      const retrievedAt = new Date().toISOString()
      const evidenceFacts: EvidenceFactInput[] = []

      const records = documentIds.map(documentId => {
        const master = masterById.get(documentId) || {}
        const recordParties = (partiesById.get(documentId) || []).map(partyFromRow)
        const properties = (legalsById.get(documentId) || []).map(legalFromRow)
        const boroughCode = str(master.recorded_borough)
        const record = {
          documentId,
          crfn: str(master.crfn),
          documentType: str(master.doc_type),
          documentDate: str(master.document_date)?.slice(0, 10) || null,
          recordedDate: str(master.recorded_datetime)?.slice(0, 10) || null,
          documentAmount: str(master.document_amt),
          percentTransferred: str(master.percent_trans),
          recordedBorough: boroughCode ? BOROUGH[boroughCode] || boroughCode : null,
          goodThroughDate: str(master.good_through_date)?.slice(0, 10) || null,
          parties: recordParties,
          properties,
          filingUrl: docImageUrl(documentId),
        }

        const facts = [
          fact('property.document_id', documentId, documentId, retrievedAt),
          fact('property.document_type', record.documentType, documentId, retrievedAt),
          fact('property.document_date', record.documentDate, documentId, retrievedAt),
          fact('property.recorded_date', record.recordedDate, documentId, retrievedAt),
          fact('property.document_amount', record.documentAmount, documentId, retrievedAt),
          fact('property.percent_transferred', record.percentTransferred, documentId, retrievedAt),
          fact('property.recorded_borough', record.recordedBorough, documentId, retrievedAt),
        ].filter((value): value is EvidenceFactInput => Boolean(value))

        for (const party of recordParties) {
          if (party.name) {
            facts.push(fact(
              'property.recorded_party',
              party.name,
              documentId,
              retrievedAt,
              { partyType: party.partyType, partyRole: party.partyRole },
              mode === 'name' ? 0.97 : 0.93
            )!)
          }
        }

        for (const property of properties) {
          const bbl = property.boroughCode && property.block && property.lot
            ? `${property.boroughCode}-${property.block}-${property.lot}`
            : null
          const address = [property.streetNumber, property.streetName, property.unit ? `Unit ${property.unit}` : null]
            .filter(Boolean).join(' ')
          if (bbl) facts.push(fact('property.bbl', bbl, documentId, retrievedAt))
          if (address) facts.push(fact('property.address', address, documentId, retrievedAt, { borough: property.borough }))
        }

        evidenceFacts.push(...facts.filter(Boolean))
        return record
      })

      records.sort((a, b) => (b.recordedDate || '').localeCompare(a.recordedDate || ''))

      return {
        success: true,
        data: {
          records: records.slice(0, 25),
          resultCount: Math.min(records.length, 25),
          coverage: 'New York City ACRIS recorded real-property instruments',
          limitation:
            'NYC-only recorded document history. Grantor/grantee or mortgage roles are document-specific and do not by themselves prove current ownership, occupancy, debt balance, or title status.',
        },
        confidenceScore: records.length > 0 ? (mode === 'name' ? 0.97 : 0.94) : 0,
        evidenceFacts,
      }
    } catch (error) {
      return {
        success: false,
        data: {},
        confidenceScore: 0,
        error: error instanceof Error ? error.message : 'NYC ACRIS lookup failed.',
      }
    }
  },
}

registerProvider(nycAcrisPropertyProvider)
