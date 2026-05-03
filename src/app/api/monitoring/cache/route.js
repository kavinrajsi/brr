import { getUserFromRequest, isPlatformAdmin } from '@/lib/supabase-server'
import { smartCache } from '@/lib/smart-cache'
import { cacheManager } from '@/lib/cache'

export async function GET(req) {
  const user = await getUserFromRequest(req)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  // Cache stats fingerprint internal state — restrict to platform admins.
  if (!isPlatformAdmin(user)) return Response.json({ error: 'Forbidden' }, { status: 403 })

  return Response.json({
    smartCache: smartCache.getStats(),
    simpleCache: cacheManager.stats(),
    timestamp: new Date().toISOString(),
  })
}
