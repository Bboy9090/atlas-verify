const rateLimitMap = new Map<string, { count: number; lastReset: number }>()

const MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX || '100', 10)
const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10)

export function checkRateLimit(identifier: string): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now()
  const record = rateLimitMap.get(identifier)

  if (!record || now - record.lastReset > WINDOW_MS) {
    rateLimitMap.set(identifier, { count: 1, lastReset: now })
    return { allowed: true, remaining: MAX_REQUESTS - 1, resetIn: WINDOW_MS }
  }

  if (record.count >= MAX_REQUESTS) {
    const resetIn = WINDOW_MS - (now - record.lastReset)
    return { allowed: false, remaining: 0, resetIn }
  }

  record.count++
  return { 
    allowed: true, 
    remaining: MAX_REQUESTS - record.count, 
    resetIn: WINDOW_MS - (now - record.lastReset) 
  }
}
