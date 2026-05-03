import { getUserFromRequest, getAdminClient, dbError } from '@/lib/supabase-server'
import { checkRateLimit } from '@/lib/rate-limiter'
import { getUserPlanLimits } from '@/lib/stripe'

export async function GET(req) {
  const user = await getUserFromRequest(req)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const limited = checkRateLimit(user.id, 100, 60000)
  if (limited) return limited

  const url = new URL(req.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1)
  const limit = 20
  const offset = (page - 1) * limit

  const supabase = getAdminClient()
  const { data, count, error } = await supabase
    .from('brands')
    .select('id, name, short_name, status, current_stage, created_at', { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) return dbError(error)

  return Response.json(
    { data, pagination: { total: count, page, limit, pages: Math.ceil(count / limit) } },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}

export async function POST(req) {
  const user = await getUserFromRequest(req)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const limited = checkRateLimit(user.id, 30, 60000)
  if (limited) return limited

  const body = await req.json()
  if (!body.name?.trim()) {
    return Response.json({ error: 'Brand name is required' }, { status: 400 })
  }

  const supabase = getAdminClient()

  const [limits, { count: brandCount }] = await Promise.all([
    getUserPlanLimits(user.id, supabase),
    supabase.from('brands').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
  ])

  if (brandCount >= limits.brands) {
    return Response.json(
      { error: `Brand limit reached. Upgrade your plan to create more brands.` },
      { status: 403 }
    )
  }

  const { data, error } = await supabase
    .from('brands')
    .insert([{
      user_id: user.id,
      name: body.name.trim(),
      short_name: body.short_name?.trim() || '',
      status: 'Draft',
      current_stage: 0,
    }])
    .select()
    .single()

  if (error) return dbError(error)
  return Response.json(data, { status: 201 })
}
