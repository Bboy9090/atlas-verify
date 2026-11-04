import type { EvidenceFactLike } from '@/lib/evidence'

export type EvidenceFreshnessStatus = 'current' | 'stale' | 'historical' | 'unknown'
export type EvidenceFreshnessBasis = 'observed' | 'retrieved' | 'unknown'

export interface EvidenceFreshnessItem {
  id?: string
  field: string
  sourceName: string
  status: EvidenceFreshnessStatus
  basis: EvidenceFreshnessBasis
  timestamp: string | null
  observedAt: string | null
  retrievedAt: string | null
  ageDays: number | null
}

export interface EvidenceFreshnessLedger {
  generatedAt: string
  currentThroughDays: number
  staleThroughDays: number
  currentCount: number
  staleCount: number
  historicalCount: number
  unknownCount: number
  lastSeenAt: string | null
  lastRetrievedAt: string | null
  items: EvidenceFreshnessItem[]
}

const DAY_MS = 24 * 60 * 60 * 1000
const CURRENT_THROUGH_DAYS = 90
const STALE_THROUGH_DAYS = 365

function validDate(value: Date | string | null | undefined): Date | null {
  if (value === null || value === undefined) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isFinite(date.getTime()) ? date : null
}

function statusForAge(ageDays: number | null): EvidenceFreshnessStatus {
  if (ageDays === null) return 'unknown'
  if (ageDays <= CURRENT_THROUGH_DAYS) return 'current'
  if (ageDays <= STALE_THROUGH_DAYS) return 'stale'
  return 'historical'
}

export function buildEvidenceFreshnessLedger(
  facts: EvidenceFactLike[],
  now = new Date(),
): EvidenceFreshnessLedger {
  const items = facts.map((fact): EvidenceFreshnessItem => {
    const observed = validDate(fact.observedAt)
    const retrieved = validDate(fact.retrievedAt)
    const reference = observed ?? retrieved
    const basis: EvidenceFreshnessBasis = observed ? 'observed' : retrieved ? 'retrieved' : 'unknown'
    const ageDays = reference
      ? Math.max(0, Math.floor((now.getTime() - reference.getTime()) / DAY_MS))
      : null

    return {
      id: fact.id,
      field: fact.field,
      sourceName: fact.sourceName,
      status: statusForAge(ageDays),
      basis,
      timestamp: reference?.toISOString() ?? null,
      observedAt: observed?.toISOString() ?? null,
      retrievedAt: retrieved?.toISOString() ?? null,
      ageDays,
    }
  })

  items.sort((a, b) => {
    if (!a.timestamp && !b.timestamp) return a.field.localeCompare(b.field)
    if (!a.timestamp) return 1
    if (!b.timestamp) return -1
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  })

  const latestReference = items.find(item => item.timestamp)?.timestamp ?? null
  const latestRetrieved = facts
    .map(fact => validDate(fact.retrievedAt))
    .filter((date): date is Date => date !== null)
    .sort((a, b) => b.getTime() - a.getTime())[0]?.toISOString() ?? null

  return {
    generatedAt: now.toISOString(),
    currentThroughDays: CURRENT_THROUGH_DAYS,
    staleThroughDays: STALE_THROUGH_DAYS,
    currentCount: items.filter(item => item.status === 'current').length,
    staleCount: items.filter(item => item.status === 'stale').length,
    historicalCount: items.filter(item => item.status === 'historical').length,
    unknownCount: items.filter(item => item.status === 'unknown').length,
    lastSeenAt: latestReference,
    lastRetrievedAt: latestRetrieved,
    items: items.slice(0, 12),
  }
}
