import { getUserFromRequest, getAdminClient } from '@/lib/supabase-server'

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
  const { data: owned } = await supabase
    .from('brands')
    .select('id')
    .eq('user_id', user.id)
    .in('id', brandIds)

  if (!owned || owned.length !== brandIds.length) {
    return Response.json({ error: 'You do not own all specified brands' }, { status: 403 })
  }

  const agents = brandIds.map((brandId, idx) => ({
    brand_id: brandId,
    name: `${agentNamePrefix}-${idx + 1}`,
    status: 'Training',
    current_stage: 0,
  }))

  const { data, error } = await supabase.from('agents').insert(agents).select()
  if (error) return Response.json({ error: error.message }, { status: 400 })

  return Response.json({
    message: `Created ${data.length} agents`,
    agents: data,
    created: data.length,
  })
}
