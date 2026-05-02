import { getUserFromRequest, getAdminClient, dbError } from '@/lib/supabase-server'

async function assertDocOwner(supabase, docId, userId) {
  const { data } = await supabase
    .from('brand_knowledge')
    .select('id, brands!inner(user_id)')
    .eq('id', docId)
    .eq('brands.user_id', userId)
    .single()
  return data || null
}

export async function PUT(req, { params }) {
  const user = await getUserFromRequest(req)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { docId } = await params
  const supabase = getAdminClient()

  const owned = await assertDocOwner(supabase, docId, user.id)
  if (!owned) return Response.json({ error: 'Document not found' }, { status: 404 })

  const body = await req.json()
  if (!body.title?.trim() || !body.content?.trim()) {
    return Response.json({ error: 'title and content are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('brand_knowledge')
    .update({ title: body.title.trim(), content: body.content.trim(), updated_at: new Date().toISOString() })
    .eq('id', docId)
    .select()
    .single()

  if (error) return dbError(error)
  return Response.json(data)
}

export async function DELETE(req, { params }) {
  const user = await getUserFromRequest(req)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { docId } = await params
  const supabase = getAdminClient()

  const owned = await assertDocOwner(supabase, docId, user.id)
  if (!owned) return Response.json({ error: 'Document not found' }, { status: 404 })

  const { error } = await supabase.from('brand_knowledge').delete().eq('id', docId)
  if (error) return dbError(error)
  return new Response(null, { status: 204 })
}
