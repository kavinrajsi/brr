import { getUserFromRequest, getAdminClient, dbError } from '@/lib/supabase-server'
import { completeStage, failStage } from '@/lib/training-manager'

async function assertAgentOwner(supabase, agentId, userId) {
  const { data: agent } = await supabase
    .from('agents')
    .select('id, brand_id')
    .eq('id', agentId)
    .single()

  if (!agent) return null

  const { data: brand } = await supabase
    .from('brands')
    .select('id')
    .eq('id', agent.brand_id)
    .eq('user_id', userId)
    .single()

  return brand ? agent : null
}

export async function GET(req, { params }) {
  const user = await getUserFromRequest(req)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { agentId } = await params
  const supabase = getAdminClient()

  const agent = await assertAgentOwner(supabase, agentId, user.id)
  if (!agent) return Response.json({ error: 'Agent not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('training_progress')
    .select('*')
    .eq('agent_id', agentId)
    .order('stage', { ascending: true })

  if (error) return dbError(error)
  return Response.json({ agentId, progress: data })
}

export async function POST(req, { params }) {
  const user = await getUserFromRequest(req)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { agentId } = await params
  const { action, stage, data: stageData } = await req.json()

  // Removed `advance` — advancement is a side-effect of completeStage and must
  // never be triggered directly. Allowing it lets a user jump from stage 1 to 6
  // without satisfying the state machine in training-manager.js.
  if (!['complete', 'fail'].includes(action)) {
    return Response.json({ error: 'action must be complete or fail' }, { status: 400 })
  }
  if (!stage || stage < 1 || stage > 6) {
    return Response.json({ error: 'stage must be between 1 and 6' }, { status: 400 })
  }

  const supabase = getAdminClient()
  const agent = await assertAgentOwner(supabase, agentId, user.id)
  if (!agent) return Response.json({ error: 'Agent not found' }, { status: 404 })

  let result
  if (action === 'complete') result = await completeStage(agentId, stage, stageData)
  else                       result = await failStage(agentId, stage, stageData?.reason)

  return Response.json({ message: `Stage ${stage} ${action}d`, result })
}
