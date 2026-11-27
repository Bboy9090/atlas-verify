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
  if (!Number.isFinite(now.getTime())) throw new RangeError('Invalid ledger reference time')
  const items = facts.map((fact): EvidenceFreshnessItem => {
    const observed = validDate(fact.observedAt)
    const retrieved = validDate(fact.retrievedAt)
    // Retrieval proves when a record was acquired, not when its content was true.
    const validObserved = observed && observed.getTime() <= now.getTime() &&
      (!retrieved || observed.getTime() <= retrieved.getTime()) ? observed : null
    const validRetrieved = retrieved && retrieved.getTime() <= now.getTime() ? retrieved : null
    const reference = validObserved ?? validRetrieved
    const basis: EvidenceFreshnessBasis = validObserved ? 'observed' : validRetrieved ? 'retrieved' : 'unknown'
    const ageDays = validObserved
      ? Math.floor((now.getTime() - validObserved.getTime()) / DAY_MS)
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

  const latestReference = items
    .filter(item => item.basis === 'observed')
    .map(item => item.timestamp!)[0] ?? null
  const latestRetrieved = facts
    .map(fact => validDate(fact.retrievedAt))
    .filter((date): date is Date => date !== null && date.getTime() <= now.getTime())
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
