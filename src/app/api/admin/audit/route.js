import { getUserFromRequest, getAdminClient, dbError } from '@/lib/supabase-server'

export async function GET(req) {
  const user = await getUserFromRequest(req)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1)
  const limit = 20
  const offset = (page - 1) * limit
  const action = url.searchParams.get('action') ?? ''

  const supabase = getAdminClient()

  // Visibility rules:
  //   - Org events:      visible to owners/admins of that org
  //   - Personal events: visible to the user who performed them (org_id IS NULL)
  const { data: adminOrgs } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .in('role', ['owner', 'admin'])

  const orgIds = (adminOrgs ?? []).map(o => o.organization_id)

  // Build a single OR predicate covering both org events the user can see
  // and personal events the user themselves performed.
  // Postgrest .or() syntax: comma-separated, each clause a column.op.value.
  const personalClause = `and(organization_id.is.null,user_id.eq.${user.id})`
  const orFilter = orgIds.length > 0
    ? `organization_id.in.(${orgIds.join(',')}),${personalClause}`
    : personalClause

  let query = supabase
    .from('audit_logs')
    .select('*', { count: 'exact' })
    .or(orFilter)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (action) query = query.ilike('action', `%${action}%`)

  const { data, count, error } = await query

  if (error) return dbError(error)

  return Response.json({
    logs: data ?? [],
    pagination: { total: count ?? 0, page, limit, pages: Math.ceil((count ?? 0) / limit) },
  })
}
