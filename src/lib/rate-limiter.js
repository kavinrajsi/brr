// NOTE: in-memory only — resets on cold starts in serverless environments.
// For production at scale, replace with Redis or Upstash.
class RateLimiter {
  constructor() {
    this.requests = new Map()
  }

  isAllowed(key, limit = 100, windowMs = 60000) {
    const now = Date.now()
    const windowStart = now - windowMs
    const timestamps = (this.requests.get(key) ?? []).filter(t => t > windowStart)

    if (timestamps.length >= limit) return false

    timestamps.push(now)
    this.requests.set(key, timestamps)
    return true
  }

  reset(key) {
    this.requests.delete(key)
  }

  getRemainingRequests(key, limit, windowMs = 60000) {
    const now = Date.now()
    const recent = (this.requests.get(key) ?? []).filter(t => t > now - windowMs)
    return Math.max(0, limit - recent.length)
  }
}

export const rateLimiter = new RateLimiter()
