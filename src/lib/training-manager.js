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

export async function completeStage(agentId, stage, results = {}, extras = {}) {
  const supabase = getAdminClient()
  const update = {
    status: 'Complete',
    validation_results: results,
    completed_at: new Date().toISOString(),
  }
  if (extras.test_scores !== undefined) update.test_scores = extras.test_scores
  if (extras.notes       !== undefined) update.notes       = extras.notes

  const { data, error } = await supabase
    .from('training_progress')
    .update(update)
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

export async function failStage(agentId, stage, reason = '', extras = {}) {
  const supabase = getAdminClient()
  const update = { status: 'Failed', validation_results: { failureReason: reason } }
  if (extras.test_scores !== undefined) update.test_scores = extras.test_scores
  if (extras.notes       !== undefined) update.notes       = extras.notes

  const { data, error } = await supabase
    .from('training_progress')
    .update(update)
    .eq('agent_id', agentId)
    .eq('stage', stage)
    .select()
    .single()

  if (error) throw error
  return data
}

// Non-terminal stage update — for in-progress edits to validation_results,
// test_scores, or notes. Status changes to Complete/Failed must go through
// completeStage/failStage, not this helper.
export async function updateStageProgress(agentId, stage, updates = {}) {
  const supabase = getAdminClient()
  const allowed = {}
  if (updates.validation_results !== undefined) allowed.validation_results = updates.validation_results
  if (updates.test_scores        !== undefined) allowed.test_scores        = updates.test_scores
  if (updates.notes              !== undefined) allowed.notes              = updates.notes
  if (Object.keys(allowed).length === 0) {
    throw new Error('No valid fields to update')
  }
  allowed.updated_at = new Date().toISOString()

  // Allow status to be set to In Progress to recover from a stuck state, but
  // never to Complete/Failed (those are terminal and gated by their own helpers).
  if (updates.status === 'In Progress') allowed.status = 'In Progress'

  const { data, error } = await supabase
    .from('training_progress')
    .update(allowed)
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
