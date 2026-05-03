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
    this.timers = new Map() // key → timeoutId, so we can cancel on overwrite/delete
    this.hits = 0
    this.misses = 0
    this.evictions = 0
  }

  // Cancel any pending eviction timer for `key` so a re-set doesn't get
  // wiped out by the previous set's timer firing (the original double-eviction bug).
  _cancelTimer(key) {
    const t = this.timers.get(key)
    if (t) {
      clearTimeout(t)
      this.timers.delete(key)
    }
  }

  set(key, value, strategy = 'default') {
    const ttl = STRATEGIES[strategy] ?? STRATEGIES.default
    if (ttl === 0) return

    this._cancelTimer(key)

    const expiresAt = Date.now() + ttl
    this.cache.set(key, { value, expiresAt, strategy, hitCount: 0, created: Date.now() })

    // .unref() so a pending timer doesn't keep a worker process alive past
    // its natural shutdown (matters for tests / cold starts).
    const timer = setTimeout(() => {
      this.cache.delete(key)
      this.timers.delete(key)
      this.evictions++
    }, ttl)
    if (typeof timer.unref === 'function') timer.unref()
    this.timers.set(key, timer)
  }

  get(key) {
    const item = this.cache.get(key)
    if (!item || Date.now() > item.expiresAt) {
      if (item) this._cancelTimer(key)
      this.cache.delete(key)
      this.misses++
      return null
    }
    item.hitCount++
    this.hits++
    return item.value
  }

  delete(key) {
    this._cancelTimer(key)
    this.cache.delete(key)
  }

  clear() {
    for (const t of this.timers.values()) clearTimeout(t)
    this.timers.clear()
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
