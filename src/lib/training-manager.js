import { getAdminClient } from './supabase-server'

export async function initializeAgentTraining(agentId) {
  const supabase = getAdminClient()
  const stages = Array.from({ length: 6 }, (_, i) => ({
    agent_id: agentId,
    stage: i + 1,
    status: i === 0 ? 'In Progress' : 'Pending',
    validation_results: {},
    test_scores: {},
  }))
  const { error } = await supabase.from('training_progress').insert(stages)
  if (error) throw error
}

export async function advanceAgentStage(agentId, newStage) {
  if (newStage < 1 || newStage > 6) throw new Error('Stage must be between 1 and 6')

  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('agents')
    .update({ current_stage: newStage, updated_at: new Date().toISOString() })
    .eq('id', agentId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function createTrainingCheckpoint(agentId, stage, validationData = {}) {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('training_progress')
    .insert([{ agent_id: agentId, stage, status: 'In Progress', validation_results: validationData }])
    .select()
    .single()

  if (error) throw error
  return data
}

export async function completeStage(agentId, stage, results = {}) {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('training_progress')
    .update({
      status: 'Complete',
      validation_results: results,
      completed_at: new Date().toISOString(),
    })
    .eq('agent_id', agentId)
    .eq('stage', stage)
    .select()
    .single()

  if (error) throw error
  if (stage < 6) {
    await advanceAgentStage(agentId, stage + 1)
    const { error: unlockErr } = await supabase
      .from('training_progress')
      .update({ status: 'In Progress' })
      .eq('agent_id', agentId)
      .eq('stage', stage + 1)
      .eq('status', 'Pending')
    if (unlockErr) throw unlockErr
  } else {
    const { error: certErr } = await supabase
      .from('agents')
      .update({ status: 'Certified', certified_at: new Date().toISOString() })
      .eq('id', agentId)
    if (certErr) throw certErr
  }
  return data
}

export async function failStage(agentId, stage, reason = '') {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('training_progress')
    .update({ status: 'Failed', validation_results: { failureReason: reason } })
    .eq('agent_id', agentId)
    .eq('stage', stage)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getAgentTrainingProgress(agentId) {
  const supabase = getAdminClient()

  const [{ data: agent, error: agentErr }, { data: progress, error: progressErr }] =
    await Promise.all([
      supabase.from('agents').select('*').eq('id', agentId).single(),
      supabase.from('training_progress').select('*').eq('agent_id', agentId).order('stage'),
    ])

  if (agentErr) throw agentErr
  if (progressErr) throw progressErr

  return {
    agent,
    progress,
    currentStage: agent.current_stage,
    completedStages: progress.filter(p => p.status === 'Complete').length,
  }
}
