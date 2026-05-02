import { getUserFromRequest, getAdminClient } from '@/lib/supabase-server'

async function assertScenarioOwner(supabase, scenarioId, userId) {
  const { data } = await supabase
    .from('test_scenarios')
    .select('id, brands!inner(user_id)')
    .eq('id', scenarioId)
    .eq('brands.user_id', userId)
    .single()
  return data || null
}

export async function PUT(req, { params }) {
  const user = await getUserFromRequest(req)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { scenarioId } = await params
  const supabase = getAdminClient()

  const owned = await assertScenarioOwner(supabase, scenarioId, user.id)
  if (!owned) return Response.json({ error: 'Scenario not found' }, { status: 404 })

  const body = await req.json()
  const { data, error } = await supabase
    .from('test_scenarios')
    .update({
      input_prompt: body.input_prompt,
      good_example: body.good_example,
      bad_example: body.bad_example,
      evaluation_criteria: body.evaluation_criteria,
    })
    .eq('id', scenarioId)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json(data)
}

export async function DELETE(req, { params }) {
  const user = await getUserFromRequest(req)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { scenarioId } = await params
  const supabase = getAdminClient()

  const owned = await assertScenarioOwner(supabase, scenarioId, user.id)
  if (!owned) return Response.json({ error: 'Scenario not found' }, { status: 404 })

  const { error } = await supabase.from('test_scenarios').delete().eq('id', scenarioId)
  if (error) return Response.json({ error: error.message }, { status: 400 })
  return new Response(null, { status: 204 })
}
