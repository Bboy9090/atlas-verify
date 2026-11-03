import type { EnrichmentPayload, EnrichmentProvider, EvidenceFactInput } from '@/types'
import { registerProvider } from './enrichment-provider'

const BASE = 'https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports'
const TERMS_URL = 'https://ofac.treasury.gov/sanctions-list-service'
const USER_AGENT = 'AtlasVerify/1.0 (+https://github.com/Bboy9090/atlas-verify)'
const CACHE_TTL_MS = 15 * 60 * 1000

type CsvRow = string[]

interface PrimaryRecord {
  entNum: string
  name: string
  entityType: string | null
  program: string | null
  remarks: string | null
  listType: 'SDN' | 'Non-SDN'
}

interface AliasRecord {
  entNum: string
  aliasType: string | null
  name: string
  remarks: string | null
}

interface AddressRecord {
  entNum: string
  address: string | null
  cityStatePostal: string | null
  country: string | null
  remarks: string | null
}

interface Dataset {
  primaries: PrimaryRecord[]
  aliases: Map<string, AliasRecord[]>
  addresses: Map<string, AddressRecord[]>
  retrievedAt: string
}

let cached: { expiresAt: number; value: Promise<Dataset> } | null = null

function clean(value: string | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  return !trimmed || trimmed === '-0-' ? null : trimmed
}

function parseCsv(text: string): CsvRow[] {
  const rows: CsvRow[] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (char === '"') {
        quoted = false
      } else {
        field += char
      }
      continue
    }

    if (char === '"') quoted = true
    else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n') {
      row.push(field.replace(/\r$/, ''))
      if (row.some(value => value.trim())) rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }

  if (field || row.length) {
    row.push(field)
    if (row.some(value => value.trim())) rows.push(row)
  }

  return rows
}

async function fetchText(filename: string) {
  const response = await fetch(`${BASE}/${filename}`, {
    headers: { Accept: 'text/csv', 'User-Agent': USER_AGENT },
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`OFAC SLS returned HTTP ${response.status} for ${filename}.`)
  return response.text()
}

function addToMap<T extends { entNum: string }>(map: Map<string, T[]>, item: T) {
  map.set(item.entNum, [...(map.get(item.entNum) || []), item])
}

async function loadDataset(): Promise<Dataset> {
  const [sdn, alt, add, cons, consAlt, consAdd] = await Promise.all([
    fetchText('sdn.csv'),
    fetchText('alt.csv'),
    fetchText('add.csv'),
    fetchText('cons_prim.csv'),
    fetchText('cons_alt.csv'),
    fetchText('cons_add.csv'),
  ])

  const primaries: PrimaryRecord[] = []
  for (const [row, listType] of [
    ...parseCsv(sdn).map(row => [row, 'SDN'] as const),
    ...parseCsv(cons).map(row => [row, 'Non-SDN'] as const),
  ]) {
    const entNum = clean(row[0])
    const name = clean(row[1])
    if (!entNum || !name) continue
    primaries.push({
      entNum,
      name,
      entityType: clean(row[2]),
      program: clean(row[3]),
      remarks: clean(row[11]),
      listType,
    })
  }

  const aliases = new Map<string, AliasRecord[]>()
  for (const row of [...parseCsv(alt), ...parseCsv(consAlt)]) {
    const entNum = clean(row[0])
    const name = clean(row[3])
    if (!entNum || !name) continue
    addToMap(aliases, {
      entNum,
      aliasType: clean(row[2]),
      name,
      remarks: clean(row[4]),
    })
  }

  const addresses = new Map<string, AddressRecord[]>()
  for (const row of [...parseCsv(add), ...parseCsv(consAdd)]) {
    const entNum = clean(row[0])
    if (!entNum) continue
    addToMap(addresses, {
      entNum,
      address: clean(row[2]),
      cityStatePostal: clean(row[3]),
      country: clean(row[4]),
      remarks: clean(row[5]),
    })
  }

  return { primaries, aliases, addresses, retrievedAt: new Date().toISOString() }
}

function getDataset() {
  if (!cached || cached.expiresAt <= Date.now()) {
    cached = { expiresAt: Date.now() + CACHE_TTL_MS, value: loadDataset() }
  }
  return cached.value
}

function normalize(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function tokens(value: string) {
  return new Set(normalize(value).split(/\s+/).filter(Boolean))
}

function scoreName(query: string, candidate: string) {
  const q = normalize(query)
  const c = normalize(candidate)
  if (!q || !c) return 0
  if (q === c) return 1
  if (c.startsWith(q) || q.startsWith(c)) return 0.92
  if (c.includes(q) || q.includes(c)) return 0.88

  const qTokens = tokens(q)
  const cTokens = tokens(c)
  let intersection = 0
  for (const token of qTokens) if (cTokens.has(token)) intersection++
  const union = new Set([...qTokens, ...cTokens]).size
  const jaccard = union ? intersection / union : 0
  if (intersection === qTokens.size && qTokens.size >= 2) return 0.86
  return jaccard >= 0.6 ? 0.72 + Math.min(0.12, jaccard * 0.12) : 0
}

function evidenceFact(
  field: string,
  value: unknown,
  record: PrimaryRecord,
  retrievedAt: string,
  metadata?: Record<string, unknown>,
  confidenceScore = 0.99
): EvidenceFactInput | null {
  if (value === null || value === undefined || value === '') return null
  return {
    field,
    value,
    normalizedValue: typeof value === 'string' ? normalize(value) : undefined,
    sourceName: 'U.S. Treasury OFAC Sanctions List Service',
    sourceType: 'public_record',
    sourceUrl: TERMS_URL,
    sourceLocator: `${record.listType} ENT_NUM:${record.entNum}`,
    legalBasis: 'Official U.S. Treasury OFAC sanctions-list data',
    retrievedAt,
    confidenceScore,
    corroborationCount: 0,
    conflictCount: 0,
    metadata: {
      listType: record.listType,
      program: record.program,
      potentialMatchOnly: true,
      manualVerificationRequired: true,
      ...metadata,
    },
  }
}

const ofacProvider: EnrichmentProvider = {
  name: 'us_treasury_ofac',
  type: 'sanctions_watchlist',
  sourcePolicy: {
    sourceKind: 'public_record',
    production: true,
    termsUrl: TERMS_URL,
    licenseName: 'U.S. Treasury OFAC Sanctions List Service',
    freshnessSeconds: 900,
    allowedPurposes: [
      'Lawful sanctions-list research',
      'Public-record due diligence',
      'Potential sanctions-match review outside regulated eligibility decisions',
    ],
    mayPersist: true,
    notes:
      'Potential-name matches require manual identity verification. A fuzzy or name-only match is never proof that a subject is sanctioned.',
  },

  async lookup(input: string): Promise<EnrichmentPayload> {
    const query = input.trim()
    if (query.length < 3 || query.length > 160) {
      return { success: false, data: {}, confidenceScore: 0, error: 'Sanctions query must be 3-160 characters.' }
    }

    try {
      const dataset = await getDataset()
      const candidates = dataset.primaries
        .map(record => {
          const primaryScore = scoreName(query, record.name)
          const aliasMatches = (dataset.aliases.get(record.entNum) || [])
            .map(alias => ({ ...alias, score: scoreName(query, alias.name) }))
            .filter(alias => alias.score > 0)
            .sort((a, b) => b.score - a.score)
          const bestAlias = aliasMatches[0]
          const matchScore = Math.max(primaryScore, bestAlias?.score || 0)
          return { record, matchScore, bestAlias, aliases: dataset.aliases.get(record.entNum) || [] }
        })
        .filter(item => item.matchScore >= 0.78)
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, 20)

      const evidenceFacts: EvidenceFactInput[] = []
      const results = candidates.map(({ record, matchScore, bestAlias, aliases }) => {
        const recordAddresses = dataset.addresses.get(record.entNum) || []
        const facts = [
          evidenceFact('sanctions.primary_name', record.name, record, dataset.retrievedAt, { matchScore }, matchScore),
          evidenceFact('sanctions.list_type', record.listType, record, dataset.retrievedAt),
          evidenceFact('sanctions.program', record.program, record, dataset.retrievedAt),
          evidenceFact('sanctions.entity_type', record.entityType, record, dataset.retrievedAt),
        ].filter((value): value is EvidenceFactInput => Boolean(value))

        if (bestAlias) {
          const aliasFact = evidenceFact(
            'sanctions.matched_alias',
            bestAlias.name,
            record,
            dataset.retrievedAt,
            { aliasType: bestAlias.aliasType, matchScore: bestAlias.score },
            bestAlias.score
          )
          if (aliasFact) facts.push(aliasFact)
        }
        evidenceFacts.push(...facts)

        return {
          entNum: record.entNum,
          primaryName: record.name,
          listType: record.listType,
          entityType: record.entityType,
          program: record.program,
          remarks: record.remarks,
          matchScore,
          matchedOn: bestAlias && bestAlias.score > primaryScoreFor(query, record.name) ? 'alias' : 'primary_name',
          matchedAlias: bestAlias?.name || null,
          aliases: aliases.slice(0, 15),
          addresses: recordAddresses.slice(0, 15),
        }
      })

      return {
        success: true,
        data: {
          results,
          resultCount: results.length,
          retrievedAt: dataset.retrievedAt,
          limitation:
            'Results are conservative name/alias candidates from official OFAC data. They are not identity conclusions. Confirm identifiers, DOB, address, nationality, entity details, and the current OFAC record before taking action.',
        },
        confidenceScore: results[0]?.matchScore ?? 0,
        evidenceFacts,
      }
    } catch (error) {
      cached = null
      return {
        success: false,
        data: {},
        confidenceScore: 0,
        error: error instanceof Error ? error.message : 'OFAC sanctions lookup failed.',
      }
    }
  },
}

function primaryScoreFor(query: string, candidate: string) {
  return scoreName(query, candidate)
}

registerProvider(ofacProvider)
