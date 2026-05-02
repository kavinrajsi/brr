import { getUserFromRequest, getAdminClient } from '@/lib/supabase-server'
import { rateLimiter } from '@/lib/rate-limiter'

function applyRateLimit(req, limit, windowMs) {
  const clientId =
    req.headers.get('x-forwarded-for') ||
    req.headers.get('x-real-ip') ||
    req.headers.get('Authorization') ||
    'anonymous'

  if (!rateLimiter.isAllowed(clientId, limit, windowMs)) {
    return Response.json(
      { error: 'Too many requests', retryAfter: Math.ceil(windowMs / 1000) },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(windowMs / 1000)) } }
    )
  }
  return null
}

export async function GET(req) {
  const limited = applyRateLimit(req, 100, 60000)
  if (limited) return limited

  const user = await getUserFromRequest(req)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

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

  if (error) return Response.json({ error: error.message }, { status: 400 })

  return Response.json(
    { data, pagination: { total: count, page, limit, pages: Math.ceil(count / limit) } },
    { headers: { 'Cache-Control': 'private, max-age=300' } }
  )
}

export async function POST(req) {
  const limited = applyRateLimit(req, 30, 60000)
  if (limited) return limited

  const user = await getUserFromRequest(req)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  if (!body.name?.trim()) {
    return Response.json({ error: 'Brand name is required' }, { status: 400 })
  }

  const supabase = getAdminClient()
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

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json(data, { status: 201 })
}
