import { getUserFromRequest, getAdminClient, dbError } from '@/lib/supabase-server'
import { completeStage, failStage } from '@/lib/training-manager'

const ALLOWED_STATUSES = ['In Progress', 'Complete', 'Failed']

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
    .eq('stage', parseInt(stage, 10))
    .single()

  if (error) return Response.json({ error: 'Stage not found' }, { status: 404 })
  return Response.json(data)
}

export async function PUT(req, { params }) {
  const user = await getUserFromRequest(req)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { agentId, stage } = await params
  const stageNum = parseInt(stage, 10)

  if (isNaN(stageNum) || stageNum < 1 || stageNum > 6) {
    return Response.json({ error: 'stage must be between 1 and 6' }, { status: 400 })
  }

  const supabase = getAdminClient()
  const agent = await assertAgentOwner(supabase, agentId, user.id)
  if (!agent) return Response.json({ error: 'Agent not found' }, { status: 404 })

  // Prevent stage skipping — only the current stage may be updated
  if (stageNum !== agent.current_stage) {
    return Response.json({ error: 'Can only update the current training stage' }, { status: 403 })
  }

  const body = await req.json()
  const { status, validation_results, test_scores, notes } = body

  if (status !== undefined && !ALLOWED_STATUSES.includes(status)) {
    return Response.json(
      { error: `status must be one of: ${ALLOWED_STATUSES.join(', ')}` },
      { status: 400 }
    )
  }

  // Route terminal transitions through training-manager to enforce state-machine invariants
  if (status === 'Complete') {
    try {
      const data = await completeStage(agentId, stageNum, validation_results ?? {})
      if (test_scores !== undefined || notes !== undefined) {
        await supabase
          .from('training_progress')
          .update({ ...(test_scores !== undefined && { test_scores }), ...(notes !== undefined && { notes }) })
          .eq('agent_id', agentId)
          .eq('stage', stageNum)
      }
      return Response.json(data)
    } catch (err) {
      return dbError(err)
    }
  }

  if (status === 'Failed') {
    try {
      const data = await failStage(agentId, stageNum, validation_results?.failureReason ?? '')
      if (test_scores !== undefined || notes !== undefined) {
        await supabase
          .from('training_progress')
          .update({ ...(test_scores !== undefined && { test_scores }), ...(notes !== undefined && { notes }) })
          .eq('agent_id', agentId)
          .eq('stage', stageNum)
      }
      return Response.json(data)
    } catch (err) {
      return dbError(err)
    }
  }

  // Non-terminal update (notes, scores, validation data on the active stage)
  const { data, error } = await supabase
    .from('training_progress')
    .update({
      ...(status !== undefined && { status }),
      ...(validation_results !== undefined && { validation_results }),
      ...(test_scores !== undefined && { test_scores }),
      ...(notes !== undefined && { notes }),
      updated_at: new Date().toISOString(),
    })
    .eq('agent_id', agentId)
    .eq('stage', stageNum)
    .select()
    .single()

  if (error) return dbError(error)
  return Response.json(data)
}
