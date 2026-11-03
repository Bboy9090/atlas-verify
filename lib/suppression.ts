import { createHash, randomBytes } from 'node:crypto'

export type SuppressionIdentifierType = 'name' | 'phone' | 'email' | 'address' | 'username'

export function normalizeSuppressionIdentifier(type: SuppressionIdentifierType, value: string): string {
  const trimmed = value.trim()

  switch (type) {
    case 'phone':
      return trimmed.replace(/[^\d+]/g, '')
    case 'email':
      return trimmed.toLowerCase()
    case 'username':
      return trimmed.replace(/^@/, '').toLowerCase()
    case 'name':
    case 'address':
      return trimmed.toLowerCase().replace(/\s+/g, ' ')
  }
}

export function hashSuppressionIdentifier(type: SuppressionIdentifierType, value: string): string {
  const normalized = normalizeSuppressionIdentifier(type, value)
  return createHash('sha256').update(`${type}:${normalized}`).digest('hex')
}

export function createSuppressionRequestToken() {
  const token = randomBytes(24).toString('base64url')
  const hash = createHash('sha256').update(token).digest('hex')
  return { token, hash }
}

export function hashSuppressionRequestToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
