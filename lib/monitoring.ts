import { createHash } from 'node:crypto'

export interface MonitorEvidenceFact {
  field: string
  value: unknown
  sourceName: string
  normalizedValue?: string | null
  rawRecordHash?: string | null
  observedAt?: Date | string | null
}

export interface EvidenceManifestEntry {
  key: string
  field: string
  sourceName: string
  valueLabel: string
}

export interface EvidenceSnapshot {
  hash: string
  factCount: number
  sourceCount: number
  manifest: EvidenceManifestEntry[]
}

export interface EvidenceChangeSummary {
  added: EvidenceManifestEntry[]
  removed: EvidenceManifestEntry[]
  addedCount: number
  removedCount: number
}

function stableValue(value: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'string') return value.trim().toLowerCase()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return JSON.stringify(value.map(stableValue))
  if (typeof value === 'object') {
    return JSON.stringify(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, stableValue(item)])
    )
  }
  return String(value)
}

function displayValue(value: unknown): string {
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function datePart(value: Date | string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toISOString() : ''
}

function canonicalEntry(fact: MonitorEvidenceFact): EvidenceManifestEntry {
  const semanticValue = fact.normalizedValue?.trim().toLowerCase() || stableValue(fact.value)
  const recordIdentity = fact.rawRecordHash?.trim().toLowerCase() || ''
  const observedAt = datePart(fact.observedAt)

  const canonical = [
    fact.field.trim().toLowerCase(),
    fact.sourceName.trim().toLowerCase(),
    semanticValue,
    recordIdentity,
    observedAt,
  ].join('|')

  return {
    key: createHash('sha256').update(canonical).digest('hex'),
    field: fact.field,
    sourceName: fact.sourceName,
    valueLabel: displayValue(fact.value).slice(0, 500),
  }
}

export function buildEvidenceSnapshot(facts: MonitorEvidenceFact[]): EvidenceSnapshot {
  const deduped = new Map<string, EvidenceManifestEntry>()

  for (const fact of facts) {
    const entry = canonicalEntry(fact)
    deduped.set(entry.key, entry)
  }

  const manifest = Array.from(deduped.values()).sort((a, b) => a.key.localeCompare(b.key))
  const canonicalKeys = manifest.map(entry => entry.key).join('\n')
  const sources = new Set(manifest.map(entry => entry.sourceName))

  return {
    hash: createHash('sha256').update(canonicalKeys).digest('hex'),
    factCount: manifest.length,
    sourceCount: sources.size,
    manifest,
  }
}

export function diffEvidenceManifests(
  previous: EvidenceManifestEntry[],
  current: EvidenceManifestEntry[]
): EvidenceChangeSummary {
  const previousMap = new Map(previous.map(entry => [entry.key, entry]))
  const currentMap = new Map(current.map(entry => [entry.key, entry]))

  const added = current.filter(entry => !previousMap.has(entry.key))
  const removed = previous.filter(entry => !currentMap.has(entry.key))

  return {
    added: added.slice(0, 100),
    removed: removed.slice(0, 100),
    addedCount: added.length,
    removedCount: removed.length,
  }
}
