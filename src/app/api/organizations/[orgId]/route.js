import { getUserFromRequest, getAdminClient } from '@/lib/supabase-server'
import { hasPermission, logAuditAction } from '@/lib/permissions'

export async function GET(req, { params }) {
  const user = await getUserFromRequest(req)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { orgId } = await params

  if (!(await hasPermission(user.id, orgId, 'org:read'))) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', orgId)
    .single()

  if (error || !data) return Response.json({ error: 'Organization not found' }, { status: 404 })
  return Response.json(data)
}

export async function PUT(req, { params }) {
  const user = await getUserFromRequest(req)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { orgId } = await params

  if (!(await hasPermission(user.id, orgId, 'org:update'))) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { name, description, logo_url, website } = body

  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('organizations')
    .update({ name, description, logo_url, website, updated_at: new Date().toISOString() })
    .eq('id', orgId)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 400 })

  await logAuditAction(orgId, user.id, 'organization_updated', {
    type: 'organization', id: orgId, changes: body,
  })
  return Response.json(data)
}

export async function DELETE(req, { params }) {
  const user = await getUserFromRequest(req)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { orgId } = await params

  if (!(await hasPermission(user.id, orgId, 'org:delete'))) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = getAdminClient()
  const { error } = await supabase.from('organizations').delete().eq('id', orgId)
  if (error) return Response.json({ error: error.message }, { status: 400 })

  return new Response(null, { status: 204 })
}
