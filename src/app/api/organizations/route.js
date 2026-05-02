import { getUserFromRequest, getAdminClient, dbError } from '@/lib/supabase-server'
import { logAuditAction } from '@/lib/permissions'
import { checkRateLimit } from '@/lib/rate-limiter'

export async function GET(req) {
  const user = await getUserFromRequest(req)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const limited = checkRateLimit(user.id, 100, 60000)
  if (limited) return limited

  const supabase = getAdminClient()
  const { data: memberships, error } = await supabase
    .from('organization_members')
    .select('role, organizations(id, name, slug, logo_url, plan, created_at)')
    .eq('user_id', user.id)

  if (error) return dbError(error)

  const organizations = (memberships ?? []).map(m => ({ ...m.organizations, role: m.role }))
  return Response.json({ organizations })
}

export async function POST(req) {
  const user = await getUserFromRequest(req)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const limited = checkRateLimit(`orgs:${user.id}`, 10, 60000)
  if (limited) return limited

  const { name, slug, description } = await req.json()

  if (!name?.trim() || !slug?.trim()) {
    return Response.json({ error: 'name and slug are required' }, { status: 400 })
  }
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return Response.json({ error: 'slug must be lowercase alphanumeric with hyphens only' }, { status: 400 })
  }

  const supabase = getAdminClient()
  const { data: org, error: orgErr } = await supabase
    .from('organizations')
    .insert([{ name: name.trim(), slug: slug.trim(), description, owner_id: user.id }])
    .select()
    .single()

  if (orgErr) return dbError(orgErr)

  const { error: memberErr } = await supabase
    .from('organization_members')
    .insert([{ organization_id: org.id, user_id: user.id, role: 'owner' }])

  if (memberErr) return dbError(memberErr)

  await logAuditAction(org.id, user.id, 'organization_created', { type: 'organization', id: org.id })
  return Response.json(org, { status: 201 })
}
