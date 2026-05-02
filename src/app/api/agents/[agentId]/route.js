import { getUserFromRequest, getAdminClient } from '@/lib/supabase-server'

async function assertAgentOwner(supabase, agentId, userId) {
  const { data } = await supabase
    .from('agents')
    .select('id, brand_id, brands!inner(user_id)')
    .eq('id', agentId)
    .eq('brands.user_id', userId)
    .single()
  return data || null
}

export async function GET(req, { params }) {
  const user = await getUserFromRequest(req)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { agentId } = await params
  const supabase = getAdminClient()

  const { data, error } = await supabase
    .from('agents')
    .select('*, brands!inner(id, name, short_name, user_id)')
    .eq('id', agentId)
    .eq('brands.user_id', user.id)
    .single()

  if (error || !data) return Response.json({ error: 'Agent not found' }, { status: 404 })
  return Response.json(data)
}

export async function PUT(req, { params }) {
  const user = await getUserFromRequest(req)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { agentId } = await params
  const supabase = getAdminClient()

  const owned = await assertAgentOwner(supabase, agentId, user.id)
  if (!owned) return Response.json({ error: 'Agent not found' }, { status: 404 })

  const body = await req.json()
  const { data, error } = await supabase
    .from('agents')
    .update({
      name: body.name,
      status: body.status,
      current_stage: body.current_stage,
      certified_at: body.certified_at,
      deployed_at: body.deployed_at,
    })
    .eq('id', agentId)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json(data)
}

export async function DELETE(req, { params }) {
  const user = await getUserFromRequest(req)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { agentId } = await params
  const supabase = getAdminClient()

  const owned = await assertAgentOwner(supabase, agentId, user.id)
  if (!owned) return Response.json({ error: 'Agent not found' }, { status: 404 })

  const { error } = await supabase.from('agents').delete().eq('id', agentId)
  if (error) return Response.json({ error: error.message }, { status: 400 })
  return new Response(null, { status: 204 })
}
