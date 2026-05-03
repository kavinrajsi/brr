import { randomBytes, createHash } from 'crypto'
import { getUserFromRequest, getAdminClient, dbError } from '@/lib/supabase-server'
import { assertAgentOwner } from '@/lib/permissions'
import { validateWebhookUrl } from '@/lib/webhook'

// Embed tokens are returned in plaintext exactly once on creation; the DB
// stores SHA-256(token). Same hashing pattern as agent_api_keys / invites.
function hashToken(raw) {
  return createHash('sha256').update(raw).digest('hex')
}

// Strict origin validation: must be an https:// URL with no path / query.
// Reuses the SSRF guard from validateWebhookUrl to also reject loopback,
// RFC1918, link-local, and cloud-metadata hostnames.
function validateOrigin(raw) {
  if (typeof raw !== 'string' || !raw.trim()) {
    return { ok: false, error: 'allowed_origin is required' }
  }
  const trimmed = raw.trim()
  // Hand it to validateWebhookUrl which enforces https + SSRF guard
  const v = validateWebhookUrl(trimmed)
  if (!v.ok) return v
  // Origin must be a bare URL — no path, query, or fragment
  const url = v.url
  if (url.pathname !== '/' || url.search || url.hash) {
    return { ok: false, error: 'allowed_origin must be a bare URL like https://example.com (no path or query)' }
  }
  // Canonicalise: strip default ports
  const port = url.port && url.port !== '443' ? `:${url.port}` : ''
  return { ok: true, normalised: `${url.protocol}//${url.hostname}${port}` }
}

export async function GET(req, { params }) {
  const user = await getUserFromRequest(req)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { agentId } = await params
  const supabase = getAdminClient()
  const owned = await assertAgentOwner(supabase, agentId, user.id)
  if (!owned) return Response.json({ error: 'Agent not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('agent_embed_tokens')
    .select('id, name, allowed_origin, token_prefix, last_used_at, created_at')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })

  if (error) return dbError(error)
  return Response.json({ tokens: data ?? [] })
}

export async function POST(req, { params }) {
  const user = await getUserFromRequest(req)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { agentId } = await params
  const body = await req.json().catch(() => null)
  if (!body) return Response.json({ error: 'Invalid JSON' }, { status: 400 })

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return Response.json({ error: 'name is required' }, { status: 400 })

  const originCheck = validateOrigin(body.allowed_origin)
  if (!originCheck.ok) return Response.json({ error: originCheck.error }, { status: 400 })

  const supabase = getAdminClient()
  const owned = await assertAgentOwner(supabase, agentId, user.id)
  if (!owned) return Response.json({ error: 'Agent not found' }, { status: 404 })

  // embed_<32 hex chars> — clearly distinct from brr_live_ API keys
  const token = `embed_${randomBytes(32).toString('hex')}`
  const tokenHash = hashToken(token)
  const tokenPrefix = token.slice(0, 12) + '…'

  const { data, error } = await supabase
    .from('agent_embed_tokens')
    .insert([{
      agent_id: agentId,
      name,
      allowed_origin: originCheck.normalised,
      token_hash: tokenHash,
      token_prefix: tokenPrefix,
    }])
    .select('id, name, allowed_origin, token_prefix, created_at')
    .single()

  if (error) return dbError(error)

  // Plaintext token returned ONCE — caller must copy it now or revoke and recreate.
  return Response.json({ ...data, token }, { status: 201 })
}
