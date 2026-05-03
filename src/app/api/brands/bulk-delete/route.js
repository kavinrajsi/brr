import { getUserFromRequest, getAdminClient, dbError } from '@/lib/supabase-server'
import { onBrandMutated } from '@/lib/cache-invalidation'
import { logAuditAction } from '@/lib/permissions'

export async function POST(req) {
  const user = await getUserFromRequest(req)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { brandIds } = await req.json()

  if (!Array.isArray(brandIds) || brandIds.length === 0) {
    return Response.json({ error: 'brandIds must be a non-empty array' }, { status: 400 })
  }
  if (brandIds.length > 50) {
    return Response.json({ error: 'Maximum 50 brands can be deleted at once' }, { status: 400 })
  }

  const supabase = getAdminClient()
  const { data: owned } = await supabase
    .from('brands')
    .select('id')
    .eq('user_id', user.id)
    .in('id', brandIds)

  if (!owned || owned.length !== brandIds.length) {
    return Response.json({ error: 'You do not own all specified brands' }, { status: 403 })
  }

  // Cascade in the same order as the single-brand DELETE in [brandId]/route.js,
  // otherwise FK constraints fail or orphan rows accumulate.
  const { data: agents } = await supabase
    .from('agents')
    .select('id')
    .in('brand_id', brandIds)

  const agentIds = (agents ?? []).map(a => a.id)

  if (agentIds.length > 0) {
    await supabase.from('agent_api_keys').delete().in('agent_id', agentIds)
    await supabase.from('training_progress').delete().in('agent_id', agentIds)
    await supabase.from('agent_conversations').delete().in('agent_id', agentIds)
    await supabase.from('agents').delete().in('id', agentIds)
  }

  await supabase.from('brand_configs').delete().in('brand_id', brandIds)
  await supabase.from('brand_knowledge').delete().in('brand_id', brandIds)
  await supabase.from('test_scenarios').delete().in('brand_id', brandIds)

  const { error } = await supabase.from('brands').delete().in('id', brandIds)
  if (error) return dbError(error)

  brandIds.forEach(id => onBrandMutated(id, user.id))

  await logAuditAction(null, user.id, 'brands_bulk_deleted', {
    type: 'brand', changes: { count: brandIds.length, brandIds },
  })

  return Response.json({ message: `Deleted ${brandIds.length} brands`, deleted: brandIds.length })
}
