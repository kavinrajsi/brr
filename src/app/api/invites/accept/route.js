import { getUserFromRequest, getAdminClient, dbError } from '@/lib/supabase-server'
import { logAuditAction } from '@/lib/permissions'
import { checkRateLimit } from '@/lib/rate-limiter'

export async function POST(req) {
  const user = await getUserFromRequest(req)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // Tight limit: prevents brute-forcing the 64-hex-char invite token
  const limited = checkRateLimit(`invite-accept:${user.id}`, 10, 60000)
  if (limited) return limited

  const { token } = await req.json()
  if (!token) return Response.json({ error: 'token is required' }, { status: 400 })

  const supabase = getAdminClient()
  const { data: invite, error: inviteErr } = await supabase
    .from('organization_invites')
    .select('*')
    .eq('token', token)
    .single()

  if (inviteErr || !invite) {
    return Response.json({ error: 'Invalid invite token' }, { status: 404 })
  }
  if (invite.accepted_at) {
    return Response.json({ error: 'Invite has already been accepted' }, { status: 400 })
  }
  if (new Date(invite.expires_at) < new Date()) {
    return Response.json({ error: 'Invite has expired' }, { status: 400 })
  }

  // Email must match (case-insensitive)
  if (user.email?.toLowerCase() !== invite.email.toLowerCase()) {
    return Response.json({ error: 'This invite was sent to a different email address' }, { status: 403 })
  }

  // Check if already a member
  const { data: existing } = await supabase
    .from('organization_members')
    .select('id')
    .eq('organization_id', invite.organization_id)
    .eq('user_id', user.id)
    .single()

  if (existing) {
    return Response.json({ error: 'You are already a member of this organization' }, { status: 400 })
  }

  const { error: memberErr } = await supabase
    .from('organization_members')
    .insert([{ organization_id: invite.organization_id, user_id: user.id, role: invite.role }])

  if (memberErr) return dbError(memberErr)

  await supabase
    .from('organization_invites')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invite.id)

  await logAuditAction(invite.organization_id, user.id, 'member_joined_via_invite', {
    type: 'invite', id: invite.id,
  })

  return Response.json({ organizationId: invite.organization_id, role: invite.role })
}
