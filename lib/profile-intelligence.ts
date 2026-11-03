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
  corroborated: boolean
  conflicted: boolean
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

function canonicalize(value: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'string') return value.trim().toLowerCase()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

function categoryForField(field: string): ProfileCategory {
  const normalized = field.toLowerCase()

  if (
    normalized === 'name.alias' ||
    normalized === 'person.alias' ||
    normalized === 'identity.alias' ||
    normalized.startsWith('alias.')
  ) return 'alias'

  if (
    normalized === 'phone.e164' ||
    normalized === 'phone.number' ||
    normalized === 'phone.historical' ||
    normalized === 'contact.phone' ||
    normalized.startsWith('phone.history.')
  ) return 'phone'

  if (
    normalized === 'email.address' ||
    normalized === 'email.historical' ||
    normalized === 'contact.email' ||
    normalized.startsWith('email.history.')
  ) return 'email'

  if (
    normalized === 'address.current' ||
    normalized === 'address.historical' ||
    normalized === 'contact.address' ||
    normalized.startsWith('address.history.')
  ) return 'address'

  if (
    normalized === 'relationship.relative' ||
    normalized === 'person.relative' ||
    normalized.startsWith('relative.')
  ) return 'relative'

  if (
    normalized === 'relationship.associate' ||
    normalized === 'person.associate' ||
    normalized.startsWith('associate.')
  ) return 'associate'

  if (
    normalized === 'relationship.business' ||
    normalized === 'business.name' ||
    normalized.startsWith('business.')
  ) return 'business'

  return 'other'
}

function average(values: number[]): number {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function buildProfileIntelligence(facts: EvidenceFactLike[]): ProfileIntelligence {
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
    const latest = group
      .map(fact => new Date(fact.retrievedAt))
      .filter(date => Number.isFinite(date.getTime()))
      .sort((a, b) => b.getTime() - a.getTime())[0] ?? new Date()

    const siblingValues = new Set(
      facts
        .filter(fact => fact.field.toLowerCase() === first.field.toLowerCase())
        .map(fact => canonicalize(fact.value))
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
      latestRetrievedAt: latest.toISOString(),
      corroborated: sources.length >= 2 || group.length >= 2,
      conflicted: siblingValues.size > 1,
    }
  })

  const sortItems = (category: ProfileCategory) =>
    items
      .filter(item => item.category === category)
      .sort((a, b) => {
        if (a.conflicted !== b.conflicted) return a.conflicted ? -1 : 1
        if (a.corroborated !== b.corroborated) return a.corroborated ? -1 : 1
        if (b.sourceCount !== a.sourceCount) return b.sourceCount - a.sourceCount
        return b.averageConfidence - a.averageConfidence
      })

  return {
    generatedAt: new Date().toISOString(),
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
