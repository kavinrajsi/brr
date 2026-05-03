import { getUserFromRequest, getAdminClient, dbError } from '@/lib/supabase-server'
import { cacheManager } from '@/lib/cache'
import { onBrandMutated } from '@/lib/cache-invalidation'
import { logAuditAction } from '@/lib/permissions'

async function assertBrandOwner(supabase, brandId, userId) {
  const { data, error } = await supabase
    .from('brands')
    .select('id')
    .eq('id', brandId)
    .eq('user_id', userId)
    .single()
  return !error && data ? data : null
}

export async function GET(req, { params }) {
  const user = await getUserFromRequest(req)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { brandId } = await params
  const cacheKey = `brand_${brandId}_${user.id}`
  const cached = cacheManager.get(cacheKey)

  if (cached) {
    return Response.json(cached, { headers: { 'X-Cache': 'HIT', 'Cache-Control': 'private, max-age=300' } })
  }

  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('brands')
    .select('*')
    .eq('id', brandId)
    .eq('user_id', user.id)
    .single()

  if (error || !data) return Response.json({ error: 'Brand not found' }, { status: 404 })

  cacheManager.set(cacheKey, data, 300000)
  return Response.json(data, { headers: { 'X-Cache': 'MISS', 'Cache-Control': 'private, max-age=300' } })
}

export async function PUT(req, { params }) {
  const user = await getUserFromRequest(req)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { brandId } = await params
  const supabase = getAdminClient()

  const owned = await assertBrandOwner(supabase, brandId, user.id)
  if (!owned) return Response.json({ error: 'Brand not found' }, { status: 404 })

  const body = await req.json()
  // Whitelist fields a user may modify. status / current_stage / user_id /
  // created_at are server-owned (training-manager / DB defaults) — never accept
  // them from a client payload to prevent mass-assignment.
  const update = { updated_at: new Date().toISOString() }
  if (body.name       !== undefined) update.name       = body.name
  if (body.short_name !== undefined) update.short_name = body.short_name
  if (body.notes      !== undefined) update.notes      = body.notes

  const { data, error } = await supabase
    .from('brands')
    .update(update)
    .eq('id', brandId)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return dbError(error)

  onBrandMutated(brandId, user.id)
  await logAuditAction(null, user.id, 'brand_updated', {
    type: 'brand', id: brandId, changes: update,
  })
  return Response.json(data)
}

export async function DELETE(req, { params }) {
  const user = await getUserFromRequest(req)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { brandId } = await params
  const supabase = getAdminClient()

  const owned = await assertBrandOwner(supabase, brandId, user.id)
  if (!owned) return Response.json({ error: 'Brand not found' }, { status: 404 })

  // Fetch agent IDs first so we can delete their children
  const { data: agents } = await supabase
    .from('agents')
    .select('id')
    .eq('brand_id', brandId)

  const agentIds = (agents ?? []).map(a => a.id)

  if (agentIds.length > 0) {
    await supabase.from('agent_api_keys').delete().in('agent_id', agentIds)
    await supabase.from('training_progress').delete().in('agent_id', agentIds)
    await supabase.from('agents').delete().in('id', agentIds)
  }

  await supabase.from('brand_configs').delete().eq('brand_id', brandId)
  await supabase.from('brand_knowledge').delete().eq('brand_id', brandId)
  await supabase.from('test_scenarios').delete().eq('brand_id', brandId)

  const { error } = await supabase.from('brands').delete().eq('id', brandId)
  if (error) return dbError(error)

  onBrandMutated(brandId, user.id)
  await logAuditAction(null, user.id, 'brand_deleted', {
    type: 'brand', id: brandId,
  })
  return new Response(null, { status: 204 })
}
