// Backwards-compat shim. The real implementation now lives in smart-cache.js;
// this file maps the legacy cacheManager API onto smartCache so existing
// callers and the cache-invalidation helpers don't need a sweeping rename.
//
// Maps the requested ttl to the closest strategy in smart-cache:
//   ≤  60_000 → 'short'
//   ≤ 300_000 → 'default'
//   else      → 'static'
//
// New code should import { smartCache } from '@/lib/smart-cache' directly
// and pass an explicit strategy.

import { smartCache } from './smart-cache'

function ttlToStrategy(ttl) {
  if (ttl <= 60_000)  return 'short'
  if (ttl <= 300_000) return 'default'
  return 'static'
}

export const cacheManager = {
  set(key, value, ttl = 300_000) {
    smartCache.set(key, value, ttlToStrategy(ttl))
  },
  get(key) {
    return smartCache.get(key)
  },
  delete(key) {
    smartCache.delete(key)
  },
  clear() {
    smartCache.clear()
  },
  stats() {
    const full = smartCache.getStats()
    return { size: full.size, keys: full.items.map(i => i.key) }
  },
}
