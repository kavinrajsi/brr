import { getUserFromRequest, getAdminClient, dbError } from '@/lib/supabase-server'

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

  // current_stage and certified_at are owned by training-manager.js — never write them here.
  // The only allowed status transition through this route is Certified → Deployed.
  const update = {}
  if (body.name !== undefined) update.name = body.name
  if (body.status === 'Deployed') {
    const { data: current } = await supabase.from('agents').select('status').eq('id', agentId).single()
    if (current?.status !== 'Certified') {
      return Response.json({ error: 'Agent must be Certified before it can be Deployed' }, { status: 422 })
    }
    update.status = 'Deployed'
    update.deployed_at = body.deployed_at ?? new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('agents')
    .update(update)
    .eq('id', agentId)
    .select()
    .single()

  if (error) return dbError(error)
  return Response.json(data)
}

export async function DELETE(req, { params }) {
  const user = await getUserFromRequest(req)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { agentId } = await params
  const supabase = getAdminClient()

  const owned = await assertAgentOwner(supabase, agentId, user.id)
  if (!owned) return Response.json({ error: 'Agent not found' }, { status: 404 })

  await supabase.from('agent_api_keys').delete().eq('agent_id', agentId)
  await supabase.from('training_progress').delete().eq('agent_id', agentId)

  const { error } = await supabase.from('agents').delete().eq('id', agentId)
  if (error) return dbError(error)
  return new Response(null, { status: 204 })
}
