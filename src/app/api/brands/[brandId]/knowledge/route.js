import { getUserFromRequest, getAdminClient, dbError } from '@/lib/supabase-server'

async function assertBrandOwner(supabase, brandId, userId) {
  const { data } = await supabase
    .from('brands').select('id').eq('id', brandId).eq('user_id', userId).single()
  return data || null
}

export async function GET(req, { params }) {
  const user = await getUserFromRequest(req)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { brandId } = await params
  const supabase = getAdminClient()

  const owned = await assertBrandOwner(supabase, brandId, user.id)
  if (!owned) return Response.json({ error: 'Brand not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('brand_knowledge')
    .select('*')
    .eq('brand_id', brandId)
    .order('created_at', { ascending: false })

  if (error) return dbError(error)
  return Response.json(data ?? [])
}

export async function POST(req, { params }) {
  const user = await getUserFromRequest(req)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { brandId } = await params
  const supabase = getAdminClient()

  const owned = await assertBrandOwner(supabase, brandId, user.id)
  if (!owned) return Response.json({ error: 'Brand not found' }, { status: 404 })

  const body = await req.json()
  if (!body.title?.trim() || !body.content?.trim()) {
    return Response.json({ error: 'title and content are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('brand_knowledge')
    .insert([{ brand_id: brandId, title: body.title.trim(), content: body.content.trim() }])
    .select()
    .single()

  if (error) return dbError(error)
  return Response.json(data, { status: 201 })
}
