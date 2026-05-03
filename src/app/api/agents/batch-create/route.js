import { getUserFromRequest, getAdminClient, dbError } from '@/lib/supabase-server'
import { getUserPlanLimits } from '@/lib/stripe'
import { logAuditAction } from '@/lib/permissions'

export async function POST(req) {
  const user = await getUserFromRequest(req)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { brandIds, agentNamePrefix = 'Agent' } = await req.json()

  if (!Array.isArray(brandIds) || brandIds.length === 0) {
    return Response.json({ error: 'brandIds must be a non-empty array' }, { status: 400 })
  }
  if (brandIds.length > 50) {
    return Response.json({ error: 'Maximum 50 agents can be created at once' }, { status: 400 })
  }

  const supabase = getAdminClient()

  // Verify ownership and gather data needed to enforce the plan agent quota
  const [{ data: owned }, { data: userBrandRows }, limits] = await Promise.all([
    supabase.from('brands').select('id').eq('user_id', user.id).in('id', brandIds),
    supabase.from('brands').select('id').eq('user_id', user.id),
    getUserPlanLimits(user.id, supabase),
  ])

  if (!owned || owned.length !== brandIds.length) {
    return Response.json({ error: 'You do not own all specified brands' }, { status: 403 })
  }

  // Enforce plan limit: existing + requested must not exceed the cap
  const userBrandIds = (userBrandRows ?? []).map(b => b.id)
  const { count: existingAgents } = userBrandIds.length
    ? await supabase.from('agents').select('*', { count: 'exact', head: true }).in('brand_id', userBrandIds)
    : { count: 0 }

  const projected = (existingAgents ?? 0) + brandIds.length
  if (projected > limits.agents) {
    return Response.json(
      {
        error: `Agent limit would be exceeded (${projected}/${limits.agents}). Upgrade your plan or reduce the batch size.`,
        existing: existingAgents ?? 0,
        requested: brandIds.length,
        cap: limits.agents,
      },
      { status: 403 }
    )
  }

  const agents = brandIds.map((brandId, idx) => ({
    brand_id: brandId,
    name: `${agentNamePrefix}-${idx + 1}`,
    status: 'Training',
    current_stage: 0,
  }))

  const { data, error } = await supabase.from('agents').insert(agents).select()
  if (error) return dbError(error)

  await logAuditAction(null, user.id, 'agents_batch_created', {
    type: 'agent', changes: { count: data.length, agentIds: data.map(a => a.id), brandIds },
  })

  return Response.json({
    message: `Created ${data.length} agents`,
    agents: data,
    created: data.length,
  })
}
