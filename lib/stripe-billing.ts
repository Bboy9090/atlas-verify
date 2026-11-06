import crypto from 'node:crypto'

const STRIPE_API = 'https://api.stripe.com/v1'

export type StripeObject = Record<string, unknown>

function stripeSecret(): string {
  const value = process.env.STRIPE_SECRET_KEY?.trim()
  if (!value) throw new Error('STRIPE_SECRET_KEY is not configured')
  return value
}

export function configuredStripePriceId(): string | null {
  return process.env.STRIPE_PRICE_ID?.trim() || null
}

export function billingBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_BASE_URL?.trim() || process.env.NEXTAUTH_URL?.trim()
  if (!raw) throw new Error('Application base URL is not configured')
  const url = new URL(raw)
  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
    throw new Error('Production billing requires an HTTPS application URL')
  }
  return url.origin
}

export async function stripeRequest(
  path: string,
  params: URLSearchParams,
): Promise<StripeObject> {
  const response = await fetch(`${STRIPE_API}${path}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${stripeSecret()}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
    cache: 'no-store',
  })

  const payload = await response.json() as StripeObject
  if (!response.ok) {
    const error = payload.error as { message?: string } | undefined
    throw new Error(error?.message || `Stripe request failed with HTTP ${response.status}`)
  }
  return payload
}

export function verifyStripeWebhook(rawBody: string, signatureHeader: string): void {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim()
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET is not configured')

  const parts = signatureHeader.split(',').map(part => part.trim())
  const timestampPart = parts.find(part => part.startsWith('t='))
  const signatures = parts
    .filter(part => part.startsWith('v1='))
    .map(part => part.slice(3))

  const timestamp = timestampPart?.slice(2)
  if (!timestamp || signatures.length === 0) throw new Error('Invalid Stripe signature header')

  const timestampNumber = Number(timestamp)
  if (!Number.isFinite(timestampNumber)) throw new Error('Invalid Stripe signature timestamp')
  const ageSeconds = Math.abs(Date.now() / 1000 - timestampNumber)
  if (ageSeconds > 300) throw new Error('Stripe webhook signature timestamp is outside tolerance')

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`, 'utf8')
    .digest('hex')

  const expectedBuffer = Buffer.from(expected, 'hex')
  const valid = signatures.some(signature => {
    try {
      const candidate = Buffer.from(signature, 'hex')
      return candidate.length === expectedBuffer.length &&
        crypto.timingSafeEqual(candidate, expectedBuffer)
    } catch {
      return false
    }
  })

  if (!valid) throw new Error('Stripe webhook signature verification failed')
}

export function stripeId(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    return typeof id === 'string' && id.trim() ? id : null
  }
  return null
}
