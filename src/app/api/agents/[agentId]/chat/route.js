import { createHash } from 'crypto'
import { getUserFromRequest, getAdminClient } from '@/lib/supabase-server'
import { anthropic, isAnthropicConfigured, buildBrandSystemPrompt } from '@/lib/anthropic'

async function resolveAgentFromApiKey(supabase, rawKey, agentId) {
  const keyHash = createHash('sha256').update(rawKey).digest('hex')
  const { data } = await supabase
    .from('agent_api_keys')
    .select('id, agent_id')
    .eq('key_hash', keyHash)
    .eq('agent_id', agentId)
    .single()
  if (data) {
    // Update last_used_at without blocking the response
    supabase
      .from('agent_api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', data.id)
      .then(() => {})
  }
  return data || null
}

export async function POST(req, { params }) {
  const { agentId } = await params
  const supabase = getAdminClient()

  // Support both session auth (dashboard) and API key auth (external tools)
  let authorized = false

  const authHeader = req.headers.get('authorization') ?? ''
  if (authHeader.startsWith('Bearer brr_live_')) {
    const rawKey = authHeader.slice(7)
    const keyRecord = await resolveAgentFromApiKey(supabase, rawKey, agentId)
    authorized = Boolean(keyRecord)
  } else {
    const user = await getUserFromRequest(req)
    if (user) {
      const { data } = await supabase
        .from('agents')
        .select('id, brand_id, brands!inner(user_id)')
        .eq('id', agentId)
        .eq('brands.user_id', user.id)
        .single()
      authorized = Boolean(data)
    }
  }

  if (!authorized) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  if (!isAnthropicConfigured()) {
    return Response.json({ error: 'ANTHROPIC_API_KEY is not configured' }, { status: 503 })
  }

  const { message } = await req.json()
  if (!message?.trim()) return Response.json({ error: 'message is required' }, { status: 400 })

  // Fetch agent + brand config
  const { data: agent } = await supabase
    .from('agents')
    .select('id, name, status, brands!inner(id, name, brand_configs(config))')
    .eq('id', agentId)
    .single()

  if (!agent) return Response.json({ error: 'Agent not found' }, { status: 404 })
  if (agent.status !== 'Deployed' && agent.status !== 'Certified') {
    return Response.json({ error: 'Agent is not yet deployed' }, { status: 403 })
  }

  const brandName = agent.brands.name
  const config = agent.brands.brand_configs?.[0]?.config ?? {}
  const systemPrompt = buildBrandSystemPrompt(brandName, config)

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system: systemPrompt,
    messages: [{ role: 'user', content: message }],
  })

  const reply = response.content[0]?.text ?? ''
  return Response.json({ reply, agent: agent.name, brand: brandName })
}
