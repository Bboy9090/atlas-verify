export interface EvidenceFactLike {
  id?: string
  field: string
  value: unknown
  sourceName: string
  sourceType?: string | null
  sourceUrl?: string | null
  sourceLocator?: string | null
  normalizedValue?: string | null
  rawRecordHash?: string | null
  legalBasis?: string | null
  retrievedAt: Date | string
  observedAt?: Date | string | null
  confidenceScore: number
  corroborationCount?: number
  conflictCount?: number
}

export interface EvidenceValueSummary {
  value: unknown
  canonicalValue: string
  factCount: number
  sourceCount: number
  sources: string[]
  averageConfidence: number
  latestRetrievedAt: string
}

export interface EvidenceFieldSummary {
  field: string
  factCount: number
  sourceCount: number
  uniqueValueCount: number
  corroborated: boolean
  conflicted: boolean
  staleFactCount: number
  averageConfidence: number
  values: EvidenceValueSummary[]
}

export interface EvidenceSummary {
  generatedAt: string
  totalFacts: number
  uniqueSources: number
  sourceNames: string[]
  staleFactCount: number
  corroboratedFieldCount: number
  conflictedFieldCount: number
  averageConfidence: number
  fields: EvidenceFieldSummary[]
}

const DEFAULT_STALE_AFTER_DAYS = 365

function canonicalize(value: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'string') return value.trim().toLowerCase()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)

  if (Array.isArray(value)) {
    return JSON.stringify(value.map(item => canonicalize(item)))
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, canonicalize(item)])
    return JSON.stringify(entries)
  }

  return String(value)
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function isStale(retrievedAt: Date | string, staleAfterDays: number, now: Date): boolean {
  const timestamp = new Date(retrievedAt).getTime()
  if (!Number.isFinite(timestamp)) return true
  const ageMs = now.getTime() - timestamp
  return ageMs > staleAfterDays * 24 * 60 * 60 * 1000
}

function average(values: number[]): number {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function summarizeEvidence(
  facts: EvidenceFactLike[],
  options: { staleAfterDays?: number; now?: Date } = {}
): EvidenceSummary {
  const staleAfterDays = options.staleAfterDays ?? DEFAULT_STALE_AFTER_DAYS
  const now = options.now ?? new Date()
  const grouped = new Map<string, EvidenceFactLike[]>()

  for (const fact of facts) {
    const list = grouped.get(fact.field) ?? []
    list.push(fact)
    grouped.set(fact.field, list)
  }

  const fields: EvidenceFieldSummary[] = []

  for (const [field, fieldFacts] of grouped) {
    const values = new Map<string, EvidenceFactLike[]>()

    for (const fact of fieldFacts) {
      const canonical = canonicalize(fact.value)
      const list = values.get(canonical) ?? []
      list.push(fact)
      values.set(canonical, list)
    }

    const valueSummaries = Array.from(values.entries())
      .map(([canonicalValue, valueFacts]) => {
        const sourceNames = Array.from(new Set(valueFacts.map(fact => fact.sourceName))).sort()
        const latest = valueFacts
          .map(fact => new Date(fact.retrievedAt))
          .filter(date => Number.isFinite(date.getTime()))
          .sort((a, b) => b.getTime() - a.getTime())[0] ?? now

        return {
          value: valueFacts[0]?.value,
          canonicalValue,
          factCount: valueFacts.length,
          sourceCount: sourceNames.length,
          sources: sourceNames,
          averageConfidence: average(valueFacts.map(fact => fact.confidenceScore)),
          latestRetrievedAt: latest.toISOString(),
        }
      })
      .sort((a, b) => {
        if (b.sourceCount !== a.sourceCount) return b.sourceCount - a.sourceCount
        if (b.factCount !== a.factCount) return b.factCount - a.factCount
        return b.averageConfidence - a.averageConfidence
      })

    const sourceNames = new Set(fieldFacts.map(fact => fact.sourceName))
    const staleFactCount = fieldFacts.filter(fact =>
      isStale(fact.retrievedAt, staleAfterDays, now)
    ).length

    fields.push({
      field,
      factCount: fieldFacts.length,
      sourceCount: sourceNames.size,
      uniqueValueCount: valueSummaries.length,
      corroborated: valueSummaries.some(value => value.sourceCount >= 2 || value.factCount >= 2),
      conflicted: valueSummaries.length > 1,
      staleFactCount,
      averageConfidence: average(fieldFacts.map(fact => fact.confidenceScore)),
      values: valueSummaries,
    })
  }

  fields.sort((a, b) => {
    if (a.conflicted !== b.conflicted) return a.conflicted ? -1 : 1
    if (a.corroborated !== b.corroborated) return a.corroborated ? -1 : 1
    return a.field.localeCompare(b.field)
  })

  const sourceNames = Array.from(new Set(facts.map(fact => fact.sourceName))).sort()

  return {
    generatedAt: now.toISOString(),
    totalFacts: facts.length,
    uniqueSources: sourceNames.length,
    sourceNames,
    staleFactCount: facts.filter(fact => isStale(fact.retrievedAt, staleAfterDays, now)).length,
    corroboratedFieldCount: fields.filter(field => field.corroborated).length,
    conflictedFieldCount: fields.filter(field => field.conflicted).length,
    averageConfidence: average(facts.map(fact => fact.confidenceScore)),
    fields,
  }
}

export function evidenceFreshnessLabel(retrievedAt: Date | string, now = new Date()): string {
  const date = new Date(retrievedAt)
  if (!Number.isFinite(date.getTime())) return 'Unknown age'

  const days = Math.max(0, Math.floor((now.getTime() - date.getTime()) / (24 * 60 * 60 * 1000)))
  if (days === 0) return 'Retrieved today'
  if (days === 1) return 'Retrieved 1 day ago'
  if (days < 30) return `Retrieved ${days} days ago`
  if (days < 365) return `Retrieved ${Math.floor(days / 30)} months ago`
  return `Retrieved ${Math.floor(days / 365)} years ago`
}
