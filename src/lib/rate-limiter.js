// NOTE: in-memory only — resets on cold starts in serverless environments.
// For production at scale, replace with Redis or Upstash.
//
// Sliding-window counter with O(1) amortised cost per request and a hard
// cap on memory. Old buckets are pruned on every operation; once we exceed
// MAX_KEYS we evict the oldest-touched entries.

const MAX_KEYS = 50_000

class RateLimiter {
  constructor() {
    this.requests = new Map() // key → { timestamps: number[], lastTouchedAt: number }
  }

  // Lazily prune timestamps older than the window. Bounded by `limit`,
  // so this is O(limit) per call, not O(n). Also evict the oldest key if
  // we're over MAX_KEYS — guards against unbounded growth from a key-spam
  // attack (e.g. forged X-Forwarded-For headers if you ever switch to IP keys).
  _prune(key, windowStart) {
    const entry = this.requests.get(key)
    if (!entry) return null
    entry.timestamps = entry.timestamps.filter(t => t > windowStart)
    if (entry.timestamps.length === 0) {
      this.requests.delete(key)
      return null
    }
    return entry
  }

  _evictIfFull() {
    if (this.requests.size < MAX_KEYS) return
    // Find the oldest-touched entry — single pass, only when we're at the cap
    let oldestKey = null
    let oldestAt = Infinity
    for (const [k, v] of this.requests) {
      if (v.lastTouchedAt < oldestAt) {
        oldestAt = v.lastTouchedAt
        oldestKey = k
      }
    }
    if (oldestKey) this.requests.delete(oldestKey)
  }

  isAllowed(key, limit = 100, windowMs = 60000) {
    const now = Date.now()
    const windowStart = now - windowMs

    const existing = this._prune(key, windowStart)
    const timestamps = existing?.timestamps ?? []

    if (timestamps.length >= limit) return false

    timestamps.push(now)
    this._evictIfFull()
    this.requests.set(key, { timestamps, lastTouchedAt: now })
    return true
  }

  reset(key) {
    this.requests.delete(key)
  }

  getRemainingRequests(key, limit, windowMs = 60000) {
    const now = Date.now()
    const entry = this._prune(key, now - windowMs)
    return Math.max(0, limit - (entry?.timestamps.length ?? 0))
  }

  size() { return this.requests.size }
}

export const rateLimiter = new RateLimiter()

// Convenience wrapper — returns a 429 Response or null.
// Always key by an authenticated identity (userId, agentId), not by IP — IP
// headers are spoofable by anything that can set X-Forwarded-For.
export function checkRateLimit(key, limit = 100, windowMs = 60000) {
  if (rateLimiter.isAllowed(key, limit, windowMs)) return null
  const retryAfter = Math.ceil(windowMs / 1000)
  return Response.json(
    { error: 'Too many requests', retryAfter },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } }
  )
}
