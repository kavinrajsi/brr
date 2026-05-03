import { getAdminClient } from './supabase-server'

// ─── Initialisation ───────────────────────────────────────────────────────────

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

// ─── Internal: advance the agent's current_stage pointer ──────────────────────
// Not exported — advancement is a side-effect of completeStage and must never
// be triggered directly. Removing the export prevents API routes from calling it.

async function advanceAgentStage(supabase, agentId, newStage) {
  if (newStage < 1 || newStage > 6) throw new Error('Stage must be between 1 and 6')
  const { error } = await supabase
    .from('agents')
    .update({ current_stage: newStage, updated_at: new Date().toISOString() })
    .eq('id', agentId)
  if (error) throw error
}

// ─── Completion ───────────────────────────────────────────────────────────────
// State-machine invariants enforced here:
//   1. The stage being completed must be the agent's current_stage (no skipping)
//   2. All prior stages must already be Complete (no out-of-order completion)
//   3. The row's current status must be 'In Progress' (CAS — concurrent calls
//      both update with the predicate, but only one row matches and gets the
//      transition; the other gets PGRST116 and we treat that as a no-op
//      conflict instead of a state-machine violation)
//   4. Stage 6: certified_at is set only on first completion (idempotent
//      re-complete does not reset it), and we never regress a Deployed agent
//      back to Certified

export async function completeStage(agentId, stage, results = {}, extras = {}) {
  if (!Number.isInteger(stage) || stage < 1 || stage > 6) {
    throw new Error('Stage must be an integer between 1 and 6')
  }

  const supabase = getAdminClient()

  // Pre-flight: verify state-machine invariants in a single round-trip.
  const [{ data: agent, error: agentErr }, { data: progress, error: progressErr }] = await Promise.all([
    supabase.from('agents').select('current_stage, status').eq('id', agentId).single(),
    supabase.from('training_progress').select('stage, status').eq('agent_id', agentId).order('stage'),
  ])

  if (agentErr || !agent) throw new Error('Agent not found')
  if (progressErr) throw progressErr

  if (agent.current_stage !== stage) {
    throw new Error(`Cannot complete stage ${stage}: agent is on stage ${agent.current_stage}`)
  }

  // All prior stages must be Complete
  const priorIncomplete = (progress ?? []).find(p => p.stage < stage && p.status !== 'Complete')
  if (priorIncomplete) {
    throw new Error(`Cannot complete stage ${stage}: stage ${priorIncomplete.stage} is ${priorIncomplete.status}`)
  }

  const update = {
    status: 'Complete',
    validation_results: results,
    completed_at: new Date().toISOString(),
  }
  if (extras.test_scores !== undefined) update.test_scores = extras.test_scores
  if (extras.notes       !== undefined) update.notes       = extras.notes

  // CAS: only transition the row that's still In Progress. Concurrent calls
  // both attempt this; whichever runs second sees status != 'In Progress'
  // and matches 0 rows (PGRST116 from .single()).
  const { data, error } = await supabase
    .from('training_progress')
    .update(update)
    .eq('agent_id', agentId)
    .eq('stage', stage)
    .eq('status', 'In Progress')
    .select()
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      throw new Error(`Cannot complete stage ${stage}: it is not currently In Progress (concurrent call?)`)
    }
    throw error
  }

  // Side-effects after the CAS won the race
  if (stage < 6) {
    await advanceAgentStage(supabase, agentId, stage + 1)
    const { error: unlockErr } = await supabase
      .from('training_progress')
      .update({ status: 'In Progress' })
      .eq('agent_id', agentId)
      .eq('stage', stage + 1)
      .eq('status', 'Pending')
    if (unlockErr) throw unlockErr
  } else {
    // Stage 6 — final certification.
    // Idempotency: only set certified_at on first completion.
    // No regression: if already Deployed, leave the agent's status alone.
    const certUpdate = {}
    if (agent.status !== 'Deployed' && agent.status !== 'Certified') {
      certUpdate.status = 'Certified'
    }
    // Only stamp certified_at when we're actually transitioning to Certified
    // for the first time. Use .is('certified_at', null) so a second call
    // doesn't overwrite the original cert date.
    if (Object.keys(certUpdate).length > 0) {
      certUpdate.certified_at = new Date().toISOString()
      const { error: certErr } = await supabase
        .from('agents')
        .update(certUpdate)
        .eq('id', agentId)
        .is('certified_at', null)
      if (certErr) throw certErr
    }
  }

  return data
}

// ─── Failure ──────────────────────────────────────────────────────────────────

export async function failStage(agentId, stage, reason = '', extras = {}) {
  if (!Number.isInteger(stage) || stage < 1 || stage > 6) {
    throw new Error('Stage must be an integer between 1 and 6')
  }

  const supabase = getAdminClient()
  const update = { status: 'Failed', validation_results: { failureReason: reason } }
  if (extras.test_scores !== undefined) update.test_scores = extras.test_scores
  if (extras.notes       !== undefined) update.notes       = extras.notes

  // CAS: only fail a stage that is currently In Progress
  const { data, error } = await supabase
    .from('training_progress')
    .update(update)
    .eq('agent_id', agentId)
    .eq('stage', stage)
    .eq('status', 'In Progress')
    .select()
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      throw new Error(`Cannot fail stage ${stage}: it is not currently In Progress`)
    }
    throw error
  }
  return data
}

// ─── Non-terminal updates ─────────────────────────────────────────────────────
// For in-progress edits to validation_results, test_scores, or notes. Status
// changes to Complete/Failed must go through completeStage/failStage; this
// helper rejects them.

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

// ─── Read helpers ─────────────────────────────────────────────────────────────

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
