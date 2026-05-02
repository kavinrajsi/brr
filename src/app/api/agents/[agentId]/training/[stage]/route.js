import { getUserFromRequest, getAdminClient } from '@/lib/supabase-server'

async function assertAgentOwner(supabase, agentId, userId) {
  const { data } = await supabase
    .from('agents')
    .select('id, current_stage, brands!inner(user_id)')
    .eq('id', agentId)
    .eq('brands.user_id', userId)
    .single()
  return data || null
}

export async function GET(req, { params }) {
  const user = await getUserFromRequest(req)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { agentId, stage } = await params
  const supabase = getAdminClient()

  const owned = await assertAgentOwner(supabase, agentId, user.id)
  if (!owned) return Response.json({ error: 'Agent not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('training_progress')
    .select('*')
    .eq('agent_id', agentId)
    .eq('stage', parseInt(stage))
    .single()

  if (error) return Response.json({ error: 'Stage not found' }, { status: 404 })
  return Response.json(data)
}

export async function PUT(req, { params }) {
  const user = await getUserFromRequest(req)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { agentId, stage } = await params
  const stageNum = parseInt(stage)
  const supabase = getAdminClient()

  const agent = await assertAgentOwner(supabase, agentId, user.id)
  if (!agent) return Response.json({ error: 'Agent not found' }, { status: 404 })

  const body = await req.json()
  const isCompleting = body.status === 'Complete'

  const { data, error } = await supabase
    .from('training_progress')
    .update({
      status: body.status,
      validation_results: body.validation_results,
      test_scores: body.test_scores,
      notes: body.notes,
      updated_at: new Date().toISOString(),
      ...(isCompleting ? { completed_at: new Date().toISOString() } : {}),
    })
    .eq('agent_id', agentId)
    .eq('stage', stageNum)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 400 })

  // Advance the agent and unlock the next stage when a stage completes
  if (isCompleting && stageNum < 6) {
    await supabase
      .from('agents')
      .update({ current_stage: stageNum + 1 })
      .eq('id', agentId)

    await supabase
      .from('training_progress')
      .update({ status: 'In Progress' })
      .eq('agent_id', agentId)
      .eq('stage', stageNum + 1)
  }

  // Mark agent as certified when stage 6 completes
  if (isCompleting && stageNum === 6) {
    await supabase
      .from('agents')
      .update({ status: 'Certified', certified_at: new Date().toISOString() })
      .eq('id', agentId)
  }

  return Response.json(data)
}
