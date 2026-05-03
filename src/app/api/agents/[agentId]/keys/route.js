import { createHash, randomBytes } from 'crypto'
import { getUserFromRequest, getAdminClient, dbError } from '@/lib/supabase-server'
import { checkRateLimit } from '@/lib/rate-limiter'
import { logAuditAction } from '@/lib/permissions'

async function assertAgentOwner(supabase, agentId, userId) {
  const { data } = await supabase
    .from('agents')
    .select('id, brand_id, brands!inner(user_id)')
    .eq('id', agentId)
    .eq('brands.user_id', userId)
    .single()
  return data || null
}

export async function GET(req, { params }) {
  const user = await getUserFromRequest(req)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { agentId } = await params
  const supabase = getAdminClient()

  const owned = await assertAgentOwner(supabase, agentId, user.id)
  if (!owned) return Response.json({ error: 'Agent not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('agent_api_keys')
    .select('id, name, key_prefix, last_used_at, created_at')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })

  if (error) return dbError(error)
  return Response.json({ keys: data ?? [] })
}

export async function POST(req, { params }) {
  const user = await getUserFromRequest(req)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const limited = checkRateLimit(`keys:${user.id}`, 10, 60000)
  if (limited) return limited

  const { agentId } = await params
  const supabase = getAdminClient()

  const owned = await assertAgentOwner(supabase, agentId, user.id)
  if (!owned) return Response.json({ error: 'Agent not found' }, { status: 404 })

  const { name = 'Default' } = await req.json().catch(() => ({}))

  const rawKey = `brr_live_${randomBytes(24).toString('hex')}`
  const keyHash = createHash('sha256').update(rawKey).digest('hex')
  const keyPrefix = rawKey.slice(0, 16) + '…'

  const { data, error } = await supabase
    .from('agent_api_keys')
    .insert([{ agent_id: agentId, name, key_prefix: keyPrefix, key_hash: keyHash }])
    .select('id, name, key_prefix, created_at')
    .single()

  if (error) return dbError(error)

  // Audit BEFORE returning the plaintext key. Log only metadata (id, name,
  // prefix) — never the secret itself.
  await logAuditAction(null, user.id, 'api_key_created', {
    type: 'agent_api_key', id: data.id,
    changes: { agentId, name: data.name, prefix: data.key_prefix },
  })

  // Return the raw key once — it is never stored in plaintext
  return Response.json({ ...data, key: rawKey }, { status: 201 })
}
