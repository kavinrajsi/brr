import { getUserFromRequest, getAdminClient, dbError } from '@/lib/supabase-server'
import { logAuditAction } from '@/lib/permissions'

export async function DELETE(req, { params }) {
  const user = await getUserFromRequest(req)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { agentId, keyId } = await params
  const supabase = getAdminClient()

  // Verify the key belongs to an agent the user owns
  const { data: key } = await supabase
    .from('agent_api_keys')
    .select('id, agent_id, agents!inner(brand_id, brands!inner(user_id))')
    .eq('id', keyId)
    .eq('agent_id', agentId)
    .eq('agents.brands.user_id', user.id)
    .single()

  if (!key) return Response.json({ error: 'Key not found' }, { status: 404 })

  const { error } = await supabase.from('agent_api_keys').delete().eq('id', keyId)
  if (error) return dbError(error)

  await logAuditAction(null, user.id, 'api_key_revoked', {
    type: 'agent_api_key', id: keyId, changes: { agentId },
  })

  return new Response(null, { status: 204 })
}
