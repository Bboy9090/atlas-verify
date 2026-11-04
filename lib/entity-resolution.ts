import type { EvidenceFactLike } from '@/lib/evidence'

export interface ResolutionValue {
  field: string
  canonicalValue: string
  sourceCount: number
  factCount: number
  sources: string[]
  averageConfidence: number
}

export interface EntityResolutionSummary {
  strength: 'none' | 'weak' | 'moderate' | 'strong'
  score: number
  corroboratedIdentifiers: number
  conflictedIdentifiers: number
  totalIdentifiers: number
  strongestSignals: ResolutionValue[]
  conflicts: Array<{
    field: string
    values: ResolutionValue[]
  }>
  identityConfirmed: false
}

function canonicalize(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value.trim().toLowerCase()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
}

function resolutionFieldFamily(field: string): string {
  const normalized = field.trim().toLowerCase()

  if (
    normalized === 'phone.e164' ||
    normalized === 'phone.number' ||
    normalized === 'phone.historical' ||
    normalized === 'contact.phone' ||
    normalized.startsWith('phone.history.') ||
    /(^|\.)phone(\.|$)/.test(normalized)
  ) return 'identity.phone'

  if (
    normalized === 'email.address' ||
    normalized === 'email.historical' ||
    normalized === 'contact.email' ||
    normalized.startsWith('email.history.') ||
    /(^|\.)email(s)?(\.|$)/.test(normalized)
  ) return 'identity.email'

  if (
    normalized === 'address.current' ||
    normalized === 'address.historical' ||
    normalized === 'contact.address' ||
    normalized.startsWith('address.history.') ||
    /(^|\.)address(es)?(\.|$)/.test(normalized)
  ) return 'identity.address'

  return normalized
}

export function resolveEntityEvidence(facts: EvidenceFactLike[]): EntityResolutionSummary {
  const fields = new Map<string, Map<string, EvidenceFactLike[]>>()

  for (const fact of facts) {
    const canonical = fact.normalizedValue?.trim().toLowerCase() || canonicalize(fact.value)
    if (!canonical) continue
    const fieldFamily = resolutionFieldFamily(fact.field)
    const byValue = fields.get(fieldFamily) ?? new Map<string, EvidenceFactLike[]>()
    const bucket = byValue.get(canonical) ?? []
    bucket.push(fact)
    byValue.set(canonical, bucket)
    fields.set(fieldFamily, byValue)
  }

  const values: ResolutionValue[] = []
  const conflicts: EntityResolutionSummary['conflicts'] = []
  let corroboratedIdentifiers = 0
  let conflictedIdentifiers = 0

  for (const [field, byValue] of fields) {
    const fieldValues = Array.from(byValue.entries()).map(([canonicalValue, group]) => {
      const sources = Array.from(new Set(group.map(fact => fact.sourceName))).sort()
      return {
        field,
        canonicalValue,
        sourceCount: sources.length,
        factCount: group.length,
        sources,
        averageConfidence: average(group.map(fact => fact.confidenceScore)),
      }
    }).sort((a, b) =>
      b.sourceCount - a.sourceCount ||
      b.factCount - a.factCount ||
      b.averageConfidence - a.averageConfidence
    )

    values.push(...fieldValues)
    if (fieldValues.some(value => value.sourceCount >= 2)) corroboratedIdentifiers += 1
    if (fieldValues.length > 1) {
      conflictedIdentifiers += 1
      conflicts.push({ field, values: fieldValues })
    }
  }

  const totalIdentifiers = fields.size
  const support = values
    .filter(value => value.sourceCount >= 2)
    .reduce((sum, value) => sum + Math.min(3, value.sourceCount) * value.averageConfidence, 0)
  const conflictPenalty = conflictedIdentifiers * 0.75
  const raw = totalIdentifiers ? (support - conflictPenalty) / Math.max(1, totalIdentifiers * 3) : 0
  const score = Math.max(0, Math.min(1, raw))
  const strength =
    score >= 0.66 ? 'strong' :
    score >= 0.4 ? 'moderate' :
    score > 0 ? 'weak' :
    'none'

  return {
    strength,
    score,
    corroboratedIdentifiers,
    conflictedIdentifiers,
    totalIdentifiers,
    strongestSignals: values
      .filter(value => value.sourceCount >= 2)
      .sort((a, b) =>
        b.sourceCount - a.sourceCount ||
        b.averageConfidence - a.averageConfidence
      )
      .slice(0, 8),
    conflicts: conflicts.slice(0, 8),
    identityConfirmed: false,
  }
}
