import { createHash } from 'crypto'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { z } from 'zod'
import { getAdminClient } from '@/lib/supabase-server'
import { anthropic, isAnthropicConfigured, buildBrandSystemPrompt, MODEL } from '@/lib/anthropic'
import { checkRateLimit } from '@/lib/rate-limiter'

export const runtime = 'nodejs'

// Resolve the user from a BRR API key sent in the Authorization header
async function resolveUserFromApiKey(supabase, rawKey) {
  const keyHash = createHash('sha256').update(rawKey).digest('hex')
  const { data } = await supabase
    .from('agent_api_keys')
    .select('agent_id')
    .eq('key_hash', keyHash)
    .single()
  return data ? data.agent_id : null
}

function buildMcpServer(supabase, authedAgentId) {
  const server = new McpServer({
    name: 'brr-ai',
    version: '1.0.0',
  })

  // ── Tool 1: list_agents ───────────────────────────────────────────────────
  server.tool(
    'list_agents',
    'List all deployed BRR AI agents you have access to.',
    {},
    async () => {
      let query = supabase
        .from('agents')
        .select('id, name, status, brands!inner(name)')
        .in('status', ['Deployed', 'Certified'])

      // When authenticated via API key, scope to that specific agent
      if (authedAgentId) {
        query = query.eq('id', authedAgentId)
      }

      const { data, error } = await query
      if (error) return { content: [{ type: 'text', text: `Error: ${error.message}` }] }

      const list = (data ?? []).map(a =>
        `• ${a.name} (${a.brands.name}) — id: ${a.id} — status: ${a.status}`
      ).join('\n')

      return {
        content: [{
          type: 'text',
          text: list || 'No deployed agents found.',
        }],
      }
    }
  )

  // ── Tool 2: chat_with_agent ───────────────────────────────────────────────
  server.tool(
    'chat_with_agent',
    'Send a message to a deployed BRR AI brand agent and get a brand-aligned response.',
    {
      agent_id: z.string().describe('The agent ID to chat with (from list_agents)'),
      message:  z.string().describe('The user message to send to the agent'),
    },
    async ({ agent_id, message }) => {
      if (!isAnthropicConfigured()) {
        return { content: [{ type: 'text', text: 'Error: ANTHROPIC_API_KEY is not configured on the server.' }] }
      }

      // Scope check: if authenticated via API key, only allow the matched agent
      if (authedAgentId && agent_id !== authedAgentId) {
        return { content: [{ type: 'text', text: 'Error: Unauthorized — this API key is not valid for that agent.' }] }
      }

      const { data: agent } = await supabase
        .from('agents')
        .select('id, name, status, brands!inner(name, brand_configs(config))')
        .eq('id', agent_id)
        .in('status', ['Deployed', 'Certified'])
        .single()

      if (!agent) {
        return { content: [{ type: 'text', text: 'Error: Agent not found or not deployed.' }] }
      }

      const brandName = agent.brands.name
      const config = agent.brands.brand_configs?.[0]?.config ?? {}
      const systemPrompt = buildBrandSystemPrompt(brandName, config)

      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 512,
        system: systemPrompt,
        messages: [{ role: 'user', content: message }],
      })

      const reply = response.content[0]?.text ?? ''
      return {
        content: [{
          type: 'text',
          text: `**${agent.name} (${brandName}):**\n\n${reply}`,
        }],
      }
    }
  )

  return server
}

async function handleMcp(req) {
  const supabase = getAdminClient()

  // Auth: a BRR API key is required for all MCP requests
  const authHeader = req.headers.get('authorization') ?? ''
  if (!authHeader.startsWith('Bearer brr_live_')) {
    return Response.json({ error: 'Authorization required' }, { status: 401 })
  }

  const authedAgentId = await resolveUserFromApiKey(supabase, authHeader.slice(7))
  if (!authedAgentId) {
    return Response.json({ error: 'Invalid API key' }, { status: 401 })
  }

  // Rate-limit per agent so a leaked key cannot drain the Anthropic budget
  const limited = checkRateLimit(`mcp:${authedAgentId}`, 60, 60_000)
  if (limited) return limited

  const server = buildMcpServer(supabase, authedAgentId)
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless — no session management needed
    enableJsonResponse: true,
  })

  await server.connect(transport)
  return transport.handleRequest(req)
}

export async function GET(req)    { return handleMcp(req) }
export async function POST(req)   { return handleMcp(req) }
export async function DELETE(req) { return handleMcp(req) }
