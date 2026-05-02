class CacheManager {
  constructor() {
    this.cache = new Map()
  }

  set(key, value, ttl = 300000) {
    const expiresAt = Date.now() + ttl
    this.cache.set(key, { value, expiresAt })
    setTimeout(() => this.cache.delete(key), ttl)
  }

  get(key) {
    const item = this.cache.get(key)
    if (!item) return null
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key)
      return null
    }
    return item.value
  }

  delete(key) {
    this.cache.delete(key)
  }

  clear() {
    this.cache.clear()
  }

  stats() {
    return { size: this.cache.size, keys: Array.from(this.cache.keys()) }
  }
}

export const cacheManager = new CacheManager()
