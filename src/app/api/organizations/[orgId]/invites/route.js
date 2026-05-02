import { randomBytes } from 'crypto'
import { getUserFromRequest, getAdminClient, dbError } from '@/lib/supabase-server'
import { hasPermission, logAuditAction } from '@/lib/permissions'
import { checkRateLimit } from '@/lib/rate-limiter'

export async function GET(req, { params }) {
  const user = await getUserFromRequest(req)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { orgId } = await params

  if (!(await hasPermission(user.id, orgId, 'member:invite'))) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('organization_invites')
    .select('id, email, role, expires_at, accepted_at, created_at')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })

  if (error) return dbError(error)
  return Response.json({ invites: data })
}

export async function POST(req, { params }) {
  const user = await getUserFromRequest(req)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const limited = checkRateLimit(`invites:${user.id}`, 20, 60000)
  if (limited) return limited

  const { orgId } = await params

  if (!(await hasPermission(user.id, orgId, 'member:invite'))) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { email, role = 'member' } = await req.json()

  if (!email?.trim()) return Response.json({ error: 'email is required' }, { status: 400 })
  if (!['admin', 'member', 'viewer'].includes(role)) {
    return Response.json({ error: 'role must be admin, member, or viewer' }, { status: 400 })
  }

  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days

  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('organization_invites')
    .insert([{
      organization_id: orgId,
      email: email.trim().toLowerCase(),
      role,
      invited_by: user.id,
      token,
      expires_at: expiresAt,
    }])
    .select()
    .single()

  if (error) return dbError(error)

  await logAuditAction(orgId, user.id, 'member_invited', {
    type: 'invite', id: data.id, changes: { email, role },
  })

  return Response.json({ invite: data }, { status: 201 })
}

export async function DELETE(req, { params }) {
  const user = await getUserFromRequest(req)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { orgId } = await params

  if (!(await hasPermission(user.id, orgId, 'member:invite'))) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { inviteId } = await req.json()
  if (!inviteId) return Response.json({ error: 'inviteId is required' }, { status: 400 })

  const supabase = getAdminClient()
  const { error } = await supabase
    .from('organization_invites')
    .delete()
    .eq('id', inviteId)
    .eq('organization_id', orgId)

  if (error) return dbError(error)
  return new Response(null, { status: 204 })
}
