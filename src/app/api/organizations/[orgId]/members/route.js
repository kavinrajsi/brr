import { getUserFromRequest, getAdminClient } from '@/lib/supabase-server'
import { hasPermission, logAuditAction } from '@/lib/permissions'

export async function GET(req, { params }) {
  const user = await getUserFromRequest(req)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { orgId } = await params

  if (!(await hasPermission(user.id, orgId, 'member:view'))) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('organization_members')
    .select('id, role, joined_at, user_id')
    .eq('organization_id', orgId)
    .order('joined_at', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ members: data })
}

export async function DELETE(req, { params }) {
  const user = await getUserFromRequest(req)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { orgId } = await params
  const { memberId } = await req.json()

  if (!memberId) return Response.json({ error: 'memberId is required' }, { status: 400 })

  if (!(await hasPermission(user.id, orgId, 'member:remove'))) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = getAdminClient()

  // Prevent removing the last owner
  const { data: member } = await supabase
    .from('organization_members')
    .select('role, user_id')
    .eq('id', memberId)
    .eq('organization_id', orgId)
    .single()

  if (!member) return Response.json({ error: 'Member not found' }, { status: 404 })

  if (member.role === 'owner') {
    const { count } = await supabase
      .from('organization_members')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('role', 'owner')

    if (count <= 1) {
      return Response.json({ error: 'Cannot remove the last owner' }, { status: 400 })
    }
  }

  const { error } = await supabase
    .from('organization_members')
    .delete()
    .eq('id', memberId)
    .eq('organization_id', orgId)

  if (error) return Response.json({ error: error.message }, { status: 400 })

  await logAuditAction(orgId, user.id, 'member_removed', {
    type: 'member', id: member.user_id,
  })
  return new Response(null, { status: 204 })
}

export async function PATCH(req, { params }) {
  const user = await getUserFromRequest(req)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { orgId } = await params
  const { memberId, role } = await req.json()

  if (!memberId || !role) {
    return Response.json({ error: 'memberId and role are required' }, { status: 400 })
  }
  if (!['owner', 'admin', 'member', 'viewer'].includes(role)) {
    return Response.json({ error: 'Invalid role' }, { status: 400 })
  }

  if (!(await hasPermission(user.id, orgId, 'member:role'))) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('organization_members')
    .update({ role, updated_at: new Date().toISOString() })
    .eq('id', memberId)
    .eq('organization_id', orgId)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 400 })

  await logAuditAction(orgId, user.id, 'member_role_changed', {
    type: 'member', id: memberId, changes: { role },
  })
  return Response.json(data)
}
