import { getUserFromRequest, getAdminClient, dbError } from '@/lib/supabase-server'

async function assertBrandOwner(supabase, brandId, userId) {
  const { data } = await supabase
    .from('brands').select('id').eq('id', brandId).eq('user_id', userId).single()
  return data || null
}

export async function GET(req, { params }) {
  const user = await getUserFromRequest(req)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { brandId } = await params
  const supabase = getAdminClient()

  const owned = await assertBrandOwner(supabase, brandId, user.id)
  if (!owned) return Response.json({ error: 'Brand not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('test_scenarios')
    .select('*')
    .eq('brand_id', brandId)
    .order('test_set').order('scenario_number')

  if (error) return dbError(error)
  return Response.json(data ?? [])
}

export async function POST(req, { params }) {
  const user = await getUserFromRequest(req)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { brandId } = await params
  const supabase = getAdminClient()

  const owned = await assertBrandOwner(supabase, brandId, user.id)
  if (!owned) return Response.json({ error: 'Brand not found' }, { status: 404 })

  const body = await req.json()
  if (!body.test_set || !body.scenario_number || !body.input_prompt?.trim()) {
    return Response.json({ error: 'test_set, scenario_number, and input_prompt are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('test_scenarios')
    .upsert([{
      brand_id: brandId,
      test_set: body.test_set,
      scenario_number: body.scenario_number,
      input_prompt: body.input_prompt.trim(),
      good_example: body.good_example?.trim() ?? null,
      bad_example: body.bad_example?.trim() ?? null,
      evaluation_criteria: body.evaluation_criteria ?? null,
    }], { onConflict: 'brand_id,test_set,scenario_number' })
    .select()
    .single()

  if (error) return dbError(error)
  return Response.json(data, { status: 201 })
}
