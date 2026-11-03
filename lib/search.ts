export type SearchKind = 'auto' | 'name' | 'phone' | 'email' | 'address' | 'username'

export interface SearchableSubject {
  id: string
  fullName: string
  phoneE164?: string | null
  email?: string | null
  username?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
}

export interface SearchMatch {
  score: number
  matchedFields: string[]
  detectedKind: Exclude<SearchKind, 'auto'>
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function normalizePhone(value: string): string {
  return value.replace(/\D/g, '')
}

function normalizeUsername(value: string): string {
  return value.trim().replace(/^@/, '').toLowerCase()
}

export function detectSearchKind(query: string): Exclude<SearchKind, 'auto'> {
  const trimmed = query.trim()

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return 'email'
  if (/^@[a-z0-9._-]{2,64}$/i.test(trimmed)) return 'username'

  const digits = normalizePhone(trimmed)
  if (digits.length >= 7 && digits.length >= trimmed.replace(/\s/g, '').length - 5) {
    return 'phone'
  }

  if (/\d/.test(trimmed) && /(\bst\b|\bstreet\b|\bave\b|\bavenue\b|\brd\b|\broad\b|\bblvd\b|\bdrive\b|\bdr\b|\blane\b|\bln\b)/i.test(trimmed)) {
    return 'address'
  }

  return 'name'
}

function scoreString(candidate: string | null | undefined, query: string): number {
  if (!candidate) return 0
  const a = normalizeText(candidate)
  const b = normalizeText(query)
  if (!a || !b) return 0
  if (a === b) return 1
  if (a.startsWith(b) || b.startsWith(a)) return 0.9
  if (a.includes(b) || b.includes(a)) return 0.75

  const aTokens = new Set(a.split(' '))
  const bTokens = b.split(' ')
  if (!bTokens.length) return 0
  const overlap = bTokens.filter(token => aTokens.has(token)).length / bTokens.length
  return overlap >= 0.5 ? 0.45 + overlap * 0.25 : 0
}

function scoreUsername(candidate: string | null | undefined, query: string): number {
  if (!candidate) return 0
  const a = normalizeUsername(candidate)
  const b = normalizeUsername(query)
  if (!a || !b) return 0
  if (a === b) return 1
  if (a.startsWith(b) || b.startsWith(a)) return 0.88
  if (a.includes(b) || b.includes(a)) return 0.7
  return 0
}

function scorePhone(candidate: string | null | undefined, query: string): number {
  if (!candidate) return 0
  const a = normalizePhone(candidate)
  const b = normalizePhone(query)
  if (!a || !b) return 0
  if (a === b) return 1
  if (a.endsWith(b) || b.endsWith(a)) return 0.85
  return 0
}

export function scoreSubjectMatch(
  subject: SearchableSubject,
  query: string,
  requestedKind: SearchKind = 'auto'
): SearchMatch {
  const detectedKind = requestedKind === 'auto' ? detectSearchKind(query) : requestedKind
  const scores: Array<{ field: string; score: number }> = []

  if (detectedKind === 'phone') {
    scores.push({ field: 'phone', score: scorePhone(subject.phoneE164, query) })
  } else if (detectedKind === 'email') {
    scores.push({ field: 'email', score: scoreString(subject.email, query) })
  } else if (detectedKind === 'username') {
    scores.push({ field: 'username', score: scoreUsername(subject.username, query) })
  } else if (detectedKind === 'address') {
    scores.push({ field: 'address', score: scoreString(subject.address, query) })
    scores.push({ field: 'city', score: scoreString(subject.city, query) * 0.7 })
    scores.push({ field: 'state', score: scoreString(subject.state, query) * 0.6 })
  } else {
    scores.push({ field: 'name', score: scoreString(subject.fullName, query) })
  }

  const matched = scores.filter(item => item.score > 0).sort((a, b) => b.score - a.score)
  const primary = matched[0]?.score ?? 0
  const secondaryBonus = Math.min(0.1, Math.max(0, matched.length - 1) * 0.03)

  return {
    score: Math.min(1, primary + secondaryBonus),
    matchedFields: matched.map(item => item.field),
    detectedKind,
  }
}
