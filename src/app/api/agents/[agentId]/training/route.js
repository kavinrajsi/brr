import { getUserFromRequest, getAdminClient } from '@/lib/supabase-server'

async function assertAgentOwner(supabase, agentId, userId) {
  const { data } = await supabase
    .from('agents')
    .select('id, brands!inner(user_id)')
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

  const owned = await assertAgentOwner(supabase, agentId, user.id)
  if (!owned) return Response.json({ error: 'Agent not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('training_progress')
    .select('*')
    .eq('agent_id', agentId)
    .order('stage', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json(data)
}
