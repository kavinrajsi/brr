// NOTE: in-memory only — resets on cold starts in serverless environments.
// For production at scale, replace with Redis or Upstash.

// TTL strategies keyed by data freshness requirements
const STRATEGIES = {
  static: 3600000,  // 1 hour — config/metadata that rarely changes
  default: 300000,  // 5 min
  short: 60000,     // 1 min — frequently mutated records
  realtime: 0,      // no cache
}

class SmartCache {
  constructor() {
    this.cache = new Map()
    this.hits = 0
    this.misses = 0
    this.evictions = 0
  }

  set(key, value, strategy = 'default') {
    const ttl = STRATEGIES[strategy] ?? STRATEGIES.default
    if (ttl === 0) return

    const expiresAt = Date.now() + ttl
    this.cache.set(key, { value, expiresAt, strategy, hitCount: 0, created: Date.now() })
    setTimeout(() => {
      this.cache.delete(key)
      this.evictions++
    }, ttl)
  }

  get(key) {
    const item = this.cache.get(key)
    if (!item || Date.now() > item.expiresAt) {
      this.cache.delete(key)
      this.misses++
      return null
    }
    item.hitCount++
    this.hits++
    return item.value
  }

  delete(key) {
    this.cache.delete(key)
  }

  clear() {
    this.cache.clear()
    this.hits = 0
    this.misses = 0
    this.evictions = 0
  }

  getStats() {
    const total = this.hits + this.misses
    const hitRate = total > 0 ? Math.round((this.hits / total) * 100) : 0
    return {
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      hitRate: `${hitRate}%`,
      size: this.cache.size,
      items: Array.from(this.cache.entries()).map(([key, item]) => ({
        key,
        strategy: item.strategy,
        hitCount: item.hitCount,
        fresh: Date.now() < item.expiresAt,
        ageMs: Date.now() - item.created,
      })),
    }
  }
}

export const smartCache = new SmartCache()
