import { smartCache } from './smart-cache'

// cacheManager is now a thin shim over smartCache (see lib/cache.js), so a
// single delete on smartCache is sufficient for both surfaces.

export function invalidateBrandCache(brandId, userId) {
  const keys = [
    `brand_${brandId}_${userId}`,
    `brand_${brandId}_config`,
    `brand_${brandId}_agents`,
  ]
  keys.forEach(k => smartCache.delete(k))
}

export function invalidateUserBrandsCache(userId) {
  // List caches are keyed by user; bust them on any mutation
  smartCache.delete(`user_${userId}_brands`)
}

export function invalidateAgentCache(agentId) {
  const keys = [`agent_${agentId}`, `agent_${agentId}_training`]
  keys.forEach(k => smartCache.delete(k))
}

export function onBrandMutated(brandId, userId) {
  invalidateBrandCache(brandId, userId)
  invalidateUserBrandsCache(userId)
}

export function onAgentMutated(agentId, brandId, userId) {
  invalidateAgentCache(agentId)
  invalidateBrandCache(brandId, userId)
}
