import type { EvidenceFactLike } from '@/lib/evidence'

export type ProfileCategory =
  | 'alias'
  | 'phone'
  | 'email'
  | 'address'
  | 'relative'
  | 'associate'
  | 'business'
  | 'other'

export interface ProfileIntelligenceItem {
  category: ProfileCategory
  field: string
  value: unknown
  canonicalValue: string
  sources: string[]
  sourceCount: number
  factCount: number
  averageConfidence: number
  latestRetrievedAt: string
  observedAt: string | null
  corroborated: boolean
  conflicted: boolean
  stale: boolean
}

export interface ProfileIntelligence {
  generatedAt: string
  aliases: ProfileIntelligenceItem[]
  phones: ProfileIntelligenceItem[]
  emails: ProfileIntelligenceItem[]
  addresses: ProfileIntelligenceItem[]
  relatives: ProfileIntelligenceItem[]
  associates: ProfileIntelligenceItem[]
  businesses: ProfileIntelligenceItem[]
  other: ProfileIntelligenceItem[]
}

const STALE_AFTER_DAYS = 365

function canonicalize(value: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'string') return value.trim().toLowerCase()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return JSON.stringify(value.map(canonicalize))
  if (typeof value === 'object') {
    return JSON.stringify(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonicalize(item)])
    )
  }
  return String(value)
}

function categoryForField(field: string): ProfileCategory {
  const normalized = field.toLowerCase()

  if (
    normalized === 'name.alias' ||
    normalized === 'person.alias' ||
    normalized === 'identity.alias' ||
    normalized.startsWith('alias.') ||
    normalized.includes('.alias.')
  ) return 'alias'

  if (
    normalized === 'phone.e164' ||
    normalized === 'phone.number' ||
    normalized === 'phone.historical' ||
    normalized === 'contact.phone' ||
    normalized.startsWith('phone.history.') ||
    /(^|\.)phone(\.|$)/.test(normalized)
  ) return 'phone'

  if (
    normalized === 'email.address' ||
    normalized === 'email.historical' ||
    normalized === 'contact.email' ||
    normalized.startsWith('email.history.') ||
    /(^|\.)email(s)?(\.|$)/.test(normalized)
  ) return 'email'

  if (
    normalized === 'address.current' ||
    normalized === 'address.historical' ||
    normalized === 'contact.address' ||
    normalized.startsWith('address.history.') ||
    /(^|\.)address(es)?(\.|$)/.test(normalized)
  ) return 'address'

  if (
    normalized === 'relationship.relative' ||
    normalized === 'person.relative' ||
    normalized.startsWith('relative.') ||
    /(^|\.)relative(s|ssummary)?(\.|$)/.test(normalized)
  ) return 'relative'

  if (
    normalized === 'relationship.associate' ||
    normalized === 'person.associate' ||
    normalized.startsWith('associate.') ||
    /(^|\.)associate(s|ssummary)?(\.|$)/.test(normalized)
  ) return 'associate'

  if (
    normalized === 'relationship.business' ||
    normalized === 'business.name' ||
    normalized.startsWith('business.') ||
    /(^|\.)business(es)?(\.|$)/.test(normalized)
  ) return 'business'

  return 'other'
}

function average(values: number[]): number {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function latestDate(values: Array<Date | string | null | undefined>): string | null {
  const dates = values
    .filter((value): value is Date | string => Boolean(value))
    .map(value => new Date(value))
    .filter(date => Number.isFinite(date.getTime()))
    .sort((a, b) => b.getTime() - a.getTime())
  return dates[0]?.toISOString() ?? null
}

function isStale(retrievedAt: string, now: Date): boolean {
  const timestamp = new Date(retrievedAt).getTime()
  if (!Number.isFinite(timestamp)) return true
  return now.getTime() - timestamp > STALE_AFTER_DAYS * 24 * 60 * 60 * 1000
}

export function buildProfileIntelligence(
  facts: EvidenceFactLike[],
  now = new Date()
): ProfileIntelligence {
  const groups = new Map<string, EvidenceFactLike[]>()

  for (const fact of facts) {
    const category = categoryForField(fact.field)
    const canonicalValue = canonicalize(fact.value)
    const key = `${category}::${fact.field.toLowerCase()}::${canonicalValue}`
    const group = groups.get(key) ?? []
    group.push(fact)
    groups.set(key, group)
  }

  const items: ProfileIntelligenceItem[] = Array.from(groups.entries()).map(([key, group]) => {
    const [category] = key.split('::') as [ProfileCategory]
    const first = group[0]
    const sources = Array.from(new Set(group.map(fact => fact.sourceName))).sort()
    const latestRetrievedAt = latestDate(group.map(fact => fact.retrievedAt)) ?? now.toISOString()
    const observedAt = latestDate(group.map(fact => fact.observedAt))

    const siblingValues = new Set(
      facts
        .filter(fact => fact.field.toLowerCase() === first.field.toLowerCase())
        .map(fact => canonicalize(fact.value))
    )

    const corroborationSignal = Math.max(
      sources.length,
      ...group.map(fact => fact.corroborationCount ?? 0)
    )
    const conflictSignal = Math.max(
      siblingValues.size - 1,
      ...group.map(fact => fact.conflictCount ?? 0)
    )

    return {
      category,
      field: first.field,
      value: first.value,
      canonicalValue: canonicalize(first.value),
      sources,
      sourceCount: sources.length,
      factCount: group.length,
      averageConfidence: average(group.map(fact => fact.confidenceScore)),
      latestRetrievedAt,
      observedAt,
      corroborated: corroborationSignal >= 2 || group.length >= 2,
      conflicted: conflictSignal > 0,
      stale: isStale(latestRetrievedAt, now),
    }
  })

  const sortItems = (category: ProfileCategory) =>
    items
      .filter(item => item.category === category)
      .sort((a, b) => {
        if (a.conflicted !== b.conflicted) return a.conflicted ? -1 : 1
        if (a.stale !== b.stale) return a.stale ? 1 : -1
        if (a.corroborated !== b.corroborated) return a.corroborated ? -1 : 1
        if (b.sourceCount !== a.sourceCount) return b.sourceCount - a.sourceCount
        return b.averageConfidence - a.averageConfidence
      })

  return {
    generatedAt: now.toISOString(),
    aliases: sortItems('alias'),
    phones: sortItems('phone'),
    emails: sortItems('email'),
    addresses: sortItems('address'),
    relatives: sortItems('relative'),
    associates: sortItems('associate'),
    businesses: sortItems('business'),
    other: sortItems('other'),
  }
}
