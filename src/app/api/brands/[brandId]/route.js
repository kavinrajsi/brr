import { getUserFromRequest, getAdminClient, dbError } from '@/lib/supabase-server'
import { cacheManager } from '@/lib/cache'
import { onBrandMutated } from '@/lib/cache-invalidation'

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
  const { data, error } = await supabase
    .from('brands')
    .update({
      name: body.name,
      short_name: body.short_name,
      status: body.status,
      current_stage: body.current_stage,
      notes: body.notes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', brandId)
    .select()
    .single()

  if (error) return dbError(error)

  onBrandMutated(brandId, user.id)
  return Response.json(data)
}

export async function DELETE(req, { params }) {
  const user = await getUserFromRequest(req)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { brandId } = await params
  const supabase = getAdminClient()

  const owned = await assertBrandOwner(supabase, brandId, user.id)
  if (!owned) return Response.json({ error: 'Brand not found' }, { status: 404 })

  const { error } = await supabase.from('brands').delete().eq('id', brandId)
  if (error) return dbError(error)

  onBrandMutated(brandId, user.id)
  return new Response(null, { status: 204 })
}
