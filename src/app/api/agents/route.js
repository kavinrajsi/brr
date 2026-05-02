import { getUserFromRequest, getAdminClient } from '@/lib/supabase-server'

export async function GET(req) {
  const user = await getUserFromRequest(req)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('agents')
    .select('*, brands!inner(id, name, short_name, user_id)')
    .eq('brands.user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json(data)
}

export async function POST(req) {
  const user = await getUserFromRequest(req)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { brand_id, name } = await req.json()
  if (!brand_id || !name?.trim()) {
    return Response.json({ error: 'brand_id and name are required' }, { status: 400 })
  }

  const supabase = getAdminClient()

  // Verify the brand belongs to this user
  const { data: brand } = await supabase
    .from('brands')
    .select('id')
    .eq('id', brand_id)
    .eq('user_id', user.id)
    .single()
  if (!brand) return Response.json({ error: 'Brand not found' }, { status: 404 })

  const { data: agent, error } = await supabase
    .from('agents')
    .insert([{ brand_id, name: name.trim(), status: 'Training', current_stage: 1 }])
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 400 })

  // Initialise 6 training_progress rows — stage 1 starts In Progress, rest are Pending
  const stages = Array.from({ length: 6 }, (_, i) => ({
    agent_id: agent.id,
    stage: i + 1,
    status: i === 0 ? 'In Progress' : 'Pending',
    validation_results: {},
    test_scores: {},
  }))
  await supabase.from('training_progress').insert(stages)

  return Response.json(agent, { status: 201 })
}
