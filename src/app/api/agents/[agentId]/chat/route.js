import { createHash } from 'crypto'
import { getUserFromRequest, getAdminClient } from '@/lib/supabase-server'
import {
  anthropic,
  isAnthropicConfigured,
  buildBrandSystemPrompt,
  buildCachedSystemBlock,
} from '@/lib/anthropic'
import { getKnowledgeContext } from '@/lib/knowledge'
import { triggerHandoff } from '@/lib/webhook'

async function resolveAgentFromApiKey(supabase, rawKey, agentId) {
  const keyHash = createHash('sha256').update(rawKey).digest('hex')
  const { data } = await supabase
    .from('agent_api_keys')
    .select('id, agent_id')
    .eq('key_hash', keyHash)
    .eq('agent_id', agentId)
    .single()
  if (data) {
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

  let authorized = false
  let isOwnerSession = false

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
      isOwnerSession = authorized
    }
  }

  if (!authorized) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  if (!isAnthropicConfigured()) {
    return Response.json({ error: 'ANTHROPIC_API_KEY is not configured' }, { status: 503 })
  }

  const body = await req.json()
  const { message, conversationId } = body
  if (!message?.trim()) return Response.json({ error: 'message is required' }, { status: 400 })

  const { data: agent } = await supabase
    .from('agents')
    .select('id, name, status, brands!inner(id, name, brand_configs(config))')
    .eq('id', agentId)
    .single()

  if (!agent) return Response.json({ error: 'Agent not found' }, { status: 404 })
  // Owners can test their own agent during training (Stages 2–4); external API keys still require Deployed/Certified
  if (!isOwnerSession && agent.status !== 'Deployed' && agent.status !== 'Certified') {
    return Response.json({ error: 'Agent is not yet deployed' }, { status: 403 })
  }

  const brandName = agent.brands.name
  const config = agent.brands.brand_configs?.[0]?.config ?? {}
  let systemPrompt = buildBrandSystemPrompt(brandName, config)

  // Append knowledge base documents to system prompt
  const knowledge = await getKnowledgeContext(agent.brands.id, supabase)
  if (knowledge) systemPrompt += '\n\n# Knowledge Base\n' + knowledge

  const escalationTriggers = config.escalation_triggers
    ? String(config.escalation_triggers).split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
    : []

  // Load conversation history
  let activeConversationId = conversationId
  let history = []

  if (activeConversationId) {
    const { data: msgs } = await supabase
      .from('conversation_messages')
      .select('role, content')
      .eq('conversation_id', activeConversationId)
      .order('created_at', { ascending: true })
      .limit(20)
    history = msgs ?? []
  } else {
    const { data: conv } = await supabase
      .from('agent_conversations')
      .insert({ agent_id: agentId })
      .select('id')
      .single()
    activeConversationId = conv?.id ?? null
  }

  const messages = [
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: message },
  ]

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()
      function send(obj) {
        controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`))
      }

      let accumulated = ''
      try {
        const sdkStream = anthropic.messages.stream({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 512,
          system: [buildCachedSystemBlock(systemPrompt)],
          messages,
        })

        for await (const event of sdkStream) {
          if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
            accumulated += event.delta.text
            send({ type: 'delta', text: event.delta.text })
          }
        }

        const replyLower = accumulated.toLowerCase()
        const escalation = escalationTriggers.some(t => replyLower.includes(t))

        // Persist messages and update conversation
        if (activeConversationId) {
          await supabase.from('conversation_messages').insert([
            { conversation_id: activeConversationId, role: 'user', content: message },
            { conversation_id: activeConversationId, role: 'assistant', content: accumulated, escalation_triggered: escalation },
          ])
          await supabase
            .from('agent_conversations')
            .update({ last_active_at: new Date().toISOString() })
            .eq('id', activeConversationId)
        }

        // Trigger webhook on escalation
        if (escalation) {
          const { webhook_url, webhook_secret } = config
          if (webhook_url && webhook_secret) {
            import('@/lib/webhook').then(({ triggerHandoff }) =>
              triggerHandoff(webhook_url, webhook_secret, {
                agentId,
                conversationId: activeConversationId,
                message,
                reply: accumulated,
                triggeredAt: new Date().toISOString(),
              }).catch(() => {})
            ).catch(() => {})
          }
        }

        send({ type: 'done', escalation, conversationId: activeConversationId })
      } catch (err) {
        send({ type: 'error', error: err.message ?? 'Stream error' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
