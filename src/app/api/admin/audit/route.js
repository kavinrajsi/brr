import { getUserFromRequest, getAdminClient } from '@/lib/supabase-server'

export async function GET(req) {
  const user = await getUserFromRequest(req)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1)
  const limit = 20
  const offset = (page - 1) * limit
  const action = url.searchParams.get('action') ?? ''

  const supabase = getAdminClient()

  // Get orgs where user is owner or admin
  const { data: adminOrgs } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .in('role', ['owner', 'admin'])

  const orgIds = (adminOrgs ?? []).map(o => o.organization_id)

  if (orgIds.length === 0) {
    return Response.json({ logs: [], pagination: { total: 0, page, limit, pages: 0 } })
  }

  let query = supabase
    .from('audit_logs')
    .select('*', { count: 'exact' })
    .in('organization_id', orgIds)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (action) query = query.ilike('action', `%${action}%`)

  const { data, count, error } = await query

  if (error) return Response.json({ error: error.message }, { status: 400 })

  return Response.json({
    logs: data ?? [],
    pagination: { total: count ?? 0, page, limit, pages: Math.ceil((count ?? 0) / limit) },
  })
}
