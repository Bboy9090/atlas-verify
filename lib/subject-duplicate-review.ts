import type { EvidenceFactLike } from '@/lib/evidence'

export interface DuplicateSubjectInput {
  id: string
  fullName: string
  phoneE164?: string | null
  email?: string | null
  username?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  facts: EvidenceFactLike[]
}

export interface DuplicateSubjectReview {
  subjectId: string
  fullName: string
  score: number
  strength: 'none' | 'weak' | 'moderate' | 'strong'
  overlaps: Array<{ field: string; value: string; sources: string[] }>
  conflicts: Array<{ field: string; left: string; right: string }>
  mergeRecommended: false
  identityConfirmed: false
}

function norm(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function factFamily(field: string): 'phone' | 'email' | 'address' | 'username' | null {
  const f = field.trim().toLowerCase()
  if (/(^|\.)phone(\.|$)/.test(f)) return 'phone'
  if (/(^|\.)email(s)?(\.|$)/.test(f)) return 'email'
  if (/(^|\.)address(es)?(\.|$)/.test(f)) return 'address'
  if (/(^|\.)(username|handle)(\.|$)/.test(f)) return 'username'
  return null
}

function collect(subject: DuplicateSubjectInput) {
  const values = new Map<string, Map<string, Set<string>>>()
  const add = (field: string, value: unknown, source: string) => {
    const canonical = norm(value)
    if (!canonical) return
    const byValue = values.get(field) ?? new Map<string, Set<string>>()
    const sources = byValue.get(canonical) ?? new Set<string>()
    sources.add(source)
    byValue.set(canonical, sources)
    values.set(field, byValue)
  }

  add('phone', subject.phoneE164, 'case-entered')
  add('email', subject.email, 'case-entered')
  add('username', subject.username, 'case-entered')
  add('address', subject.address, 'case-entered')

  for (const fact of subject.facts) {
    const family = factFamily(fact.field)
    if (!family) continue
    add(family, fact.normalizedValue || fact.value, fact.sourceName)
  }
  return values
}

export function compareDuplicateSubjects(
  primary: DuplicateSubjectInput,
  candidate: DuplicateSubjectInput,
): DuplicateSubjectReview {
  const a = collect(primary)
  const b = collect(candidate)
  const overlaps: DuplicateSubjectReview['overlaps'] = []
  const conflicts: DuplicateSubjectReview['conflicts'] = []

  for (const field of ['phone', 'email', 'username', 'address']) {
    const left = a.get(field)
    const right = b.get(field)
    if (!left || !right) continue

    const shared = Array.from(left.keys()).filter(value => right.has(value))
    for (const value of shared) {
      const sources = Array.from(new Set([
        ...(left.get(value) || []),
        ...(right.get(value) || []),
      ])).sort()
      overlaps.push({ field, value, sources })
    }

    if (!shared.length && left.size && right.size) {
      const leftValue = Array.from(left.keys())[0]
      const rightValue = Array.from(right.keys())[0]
      if (leftValue && rightValue) conflicts.push({ field, left: leftValue, right: rightValue })
    }
  }

  const weight: Record<string, number> = { phone: 0.35, email: 0.35, address: 0.2, username: 0.1 }
  const support = overlaps.reduce((sum, item) => sum + (weight[item.field] || 0), 0)
  const penalty = conflicts.reduce((sum, item) => sum + (weight[item.field] || 0) * 0.5, 0)
  const score = Math.max(0, Math.min(1, support - penalty))
  const strength = score >= 0.7 ? 'strong' : score >= 0.4 ? 'moderate' : score > 0 ? 'weak' : 'none'

  return {
    subjectId: candidate.id,
    fullName: candidate.fullName,
    score,
    strength,
    overlaps,
    conflicts,
    mergeRecommended: false,
    identityConfirmed: false,
  }
}

export function rankDuplicateSubjects(
  primary: DuplicateSubjectInput,
  candidates: DuplicateSubjectInput[],
): DuplicateSubjectReview[] {
  return candidates
    .filter(candidate => candidate.id !== primary.id)
    .map(candidate => compareDuplicateSubjects(primary, candidate))
    .filter(review => review.overlaps.length > 0 || review.conflicts.length > 0)
    .sort((a, b) => b.score - a.score || b.overlaps.length - a.overlaps.length)
}
