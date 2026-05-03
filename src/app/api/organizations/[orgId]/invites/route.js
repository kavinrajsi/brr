import { randomBytes, createHash } from 'crypto'
import { getUserFromRequest, getAdminClient, dbError } from '@/lib/supabase-server'
import { hasPermission, logAuditAction } from '@/lib/permissions'
import { checkRateLimit } from '@/lib/rate-limiter'

// Tokens are returned in plaintext one time only; the DB stores SHA-256(token).
// Verification compares hashes — same pattern as agent_api_keys.
function hashToken(raw) {
  return createHash('sha256').update(raw).digest('hex')
}

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
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days

  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('organization_invites')
    .insert([{
      organization_id: orgId,
      email: email.trim().toLowerCase(),
      role,
      invited_by: user.id,
      token: tokenHash,
      expires_at: expiresAt,
    }])
    .select('id, email, role, expires_at, accepted_at, created_at, organization_id')
    .single()

  if (error) return dbError(error)

  await logAuditAction(orgId, user.id, 'member_invited', {
    type: 'invite', id: data.id, changes: { email, role },
  })

  // Return the plaintext token ONCE so the caller can build the invite URL.
  // After this response it is unrecoverable — only the hash lives in the DB.
  return Response.json({ invite: data, token }, { status: 201 })
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

  await logAuditAction(orgId, user.id, 'member_invite_revoked', {
    type: 'invite', id: inviteId,
  })

  return new Response(null, { status: 204 })
}
