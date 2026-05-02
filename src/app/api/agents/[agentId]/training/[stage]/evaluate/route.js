import { getUserFromRequest, getAdminClient, dbError } from '@/lib/supabase-server'
import { anthropic, isAnthropicConfigured } from '@/lib/anthropic'

const STAGES = [
  { name: 'Brand Onboarding', description: 'Upload brand guidelines, tone of voice, and identity documents. The agent learns the foundational rules.' },
  { name: 'Knowledge Base', description: 'Feed product catalogues, FAQs, and support docs. The agent builds its working knowledge of the business.' },
  { name: 'Scenario Training', description: 'Run curated customer conversation scenarios. The agent practices applying brand tone to real situations.' },
  { name: 'Edge Case Handling', description: 'Test escalation flows, sensitive topics, and edge cases. Ensure the agent knows its boundaries.' },
  { name: 'Stress Testing', description: 'High-volume simulation to verify consistency under load. Scores must exceed threshold to advance.' },
  { name: 'Certification', description: 'Final evaluation across all dimensions. On pass, the agent receives its certification and is ready to deploy.' },
]

async function assertAgentOwner(supabase, agentId, userId) {
  const { data } = await supabase
    .from('agents')
    .select('id, brand_id, brands!inner(id, name, user_id)')
    .eq('id', agentId)
    .eq('brands.user_id', userId)
    .single()
  return data || null
}

function parseAnthropicJson(text) {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const cleaned = fenceMatch ? fenceMatch[1].trim() : text.trim()
  return JSON.parse(cleaned)
}

export async function POST(req, { params }) {
  if (!isAnthropicConfigured()) {
    return Response.json({ error: 'AI evaluation is not available — ANTHROPIC_API_KEY is not configured' }, { status: 503 })
  }

  const user = await getUserFromRequest(req)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { agentId, stage } = await params
  const stageNum = parseInt(stage, 10)
  if (isNaN(stageNum) || stageNum < 1 || stageNum > 6) {
    return Response.json({ error: 'stage must be between 1 and 6' }, { status: 400 })
  }

  const supabase = getAdminClient()
  const owned = await assertAgentOwner(supabase, agentId, user.id)
  if (!owned) return Response.json({ error: 'Agent not found' }, { status: 404 })

  const { data: brandConfigRow, error: configError } = await supabase
    .from('brand_configs')
    .select('config')
    .eq('brand_id', owned.brand_id)
    .single()

  if (configError && configError.code !== 'PGRST116') return dbError(configError)

  const config = brandConfigRow?.config ?? {}
  const stageInfo = STAGES[stageNum - 1]

  const userMessage = `
You are evaluating a brand AI agent for "${owned.brands.name}".

Stage ${stageNum}: ${stageInfo.name}
Description: ${stageInfo.description}

Brand Configuration:
${JSON.stringify(config, null, 2)}

Assess whether this agent has enough brand-specific configuration to succeed at Stage ${stageNum}.
Rate readiness 1-10 and provide 3 specific, actionable recommendations.
Respond ONLY with JSON: { "score": <1-10>, "ready": <true if score >= 7>, "recommendations": ["...", "...", "..."] }
`.trim()

  let evaluationResponse
  try {
    evaluationResponse = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: 'You are an expert brand AI training evaluator. Assess agent readiness and respond only with valid JSON.',
      messages: [{ role: 'user', content: userMessage }],
    })
  } catch (err) {
    console.error('[evaluate] Anthropic error:', err?.message)
    return Response.json({ error: 'AI evaluation failed — please try again' }, { status: 502 })
  }

  const rawText = evaluationResponse.content[0]?.text ?? ''

  try {
    const parsed = parseAnthropicJson(rawText)
    const score = Number(parsed.score)
    if (isNaN(score) || score < 1 || score > 10) throw new Error('score out of range')
    const ready = Boolean(parsed.ready ?? score >= 7)
    const recommendations = Array.isArray(parsed.recommendations)
      ? parsed.recommendations.slice(0, 3).map(String)
      : []
    return Response.json({ score, ready, recommendations })
  } catch {
    console.error('[evaluate] parse error. Raw:', rawText)
    return Response.json({
      score: null,
      ready: false,
      recommendations: [
        'The AI evaluator returned an unexpected response. Please try again.',
        'Ensure your brand configuration has tone, values, and audience details filled in.',
        'Contact support if the issue persists.',
      ],
      parseError: true,
    })
  }
}
