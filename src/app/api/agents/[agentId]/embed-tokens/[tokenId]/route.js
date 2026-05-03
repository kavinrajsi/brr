import { getUserFromRequest, getAdminClient, dbError } from '@/lib/supabase-server'
import { assertAgentOwner } from '@/lib/permissions'

export async function DELETE(req, { params }) {
  const user = await getUserFromRequest(req)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { agentId, tokenId } = await params
  const supabase = getAdminClient()

  const owned = await assertAgentOwner(supabase, agentId, user.id)
  if (!owned) return Response.json({ error: 'Agent not found' }, { status: 404 })

  const { error } = await supabase
    .from('agent_embed_tokens')
    .delete()
    .eq('id', tokenId)
    .eq('agent_id', agentId)

  if (error) return dbError(error)
  return new Response(null, { status: 204 })
}
