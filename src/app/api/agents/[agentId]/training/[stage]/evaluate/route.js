import { getUserFromRequest, getAdminClient, dbError } from '@/lib/supabase-server'
import { anthropic, isAnthropicConfigured } from '@/lib/anthropic'
import { isFilled, formatValue } from '@/lib/brand-config'

// Coerce config field for inline rendering: returns the formatted string or fallback
const fmt = (v, fallback = 'not defined') => isFilled(v) ? formatValue(v) : fallback
// Quoted variant — wraps the value in double quotes when present
const fmtQ = (v) => isFilled(v) ? `"${formatValue(v)}"` : 'MISSING'

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

// ─── Stage-specific prompt builders ──────────────────────────────────────────

function buildStage1Prompt(brandName, config) {
  const facets = {
    Physique:     ['physique', 'tagline', 'signature_products'],
    Personality:  ['personality_traits', 'tone', 'response_style'],
    Culture:      ['promise', 'key_values', 'culture_beliefs', 'culture_origin'],
    Relationship: ['relationship_type', 'escalation_triggers', 'prohibited_topics'],
    Reflection:   ['target_audience', 'reflection_archetype', 'customer_values'],
    'Self-image': ['selfimage_feeling', 'selfimage_aspiration', 'response_guidelines'],
  }

  const facetSummary = Object.entries(facets).map(([name, fields]) => {
    const filled = fields.filter(f => isFilled(config[f]))
    return `${name}: ${filled.length}/${fields.length} fields filled (${filled.length === 0 ? 'EMPTY' : filled.length < fields.length ? 'partial' : 'complete'})`
  }).join('\n')

  return `You are evaluating Stage 1 (Brand Onboarding) for "${brandName}".

Brand Prism facet completeness:
${facetSummary}

Key fields:
- Tone of voice: ${fmtQ(config.tone)}
- Response style: ${fmtQ(config.response_style)}
- Brand promise: ${fmtQ(config.promise)}
- Core values: ${fmtQ(config.key_values)}
- Prohibited topics: ${fmtQ(config.prohibited_topics)}
- Escalation triggers: ${fmtQ(config.escalation_triggers)}

Evaluate:
1. Are all 6 Brand Prism facets meaningfully completed?
2. Are the critical fields (tone, promise, prohibited topics, escalation triggers) specific enough to guide an AI agent?
3. Is there anything vague, placeholder-like, or missing that would prevent the agent from representing the brand accurately?

Score 1-10. Give 10 if all criteria are genuinely met — do not lower the score just to justify recommendations.
If score is 10, recommendations may be empty. If score is below 10, give as many specific actionable recommendations as needed to address all identified issues.
Respond ONLY with JSON: { "score": <1-10>, "ready": <true if score >= 10>, "recommendations": [] }`
}

function buildStage2Prompt(brandName, config, testScores, scenarios, knowledgeDocs) {
  const total = 25
  const passed = Object.values(testScores ?? {}).filter(v => v === 'pass').length
  const failed = Object.values(testScores ?? {}).filter(v => v === 'fail').length
  const unscored = total - passed - failed
  const pct = Math.round((passed / total) * 100)

  const setCounts = ['A', 'B', 'C', 'D', 'E'].map(set => {
    const setCounts = { pass: 0, fail: 0, total: scenarios.filter(s => s.test_set === set).length || [6,6,5,3,5][['A','B','C','D','E'].indexOf(set)] }
    Object.entries(testScores ?? {}).forEach(([key, val]) => {
      if (key.startsWith(set)) { if (val === 'pass') setCounts.pass++; else if (val === 'fail') setCounts.fail++ }
    })
    return `  Set ${set}: ${setCounts.pass} pass, ${setCounts.fail} fail, ${setCounts.total - setCounts.pass - setCounts.fail} unscored`
  }).join('\n')

  const docList = knowledgeDocs.length > 0
    ? knowledgeDocs.map(d => `  - "${d.title}" (${d.content?.length ?? 0} chars)`).join('\n')
    : '  None uploaded'

  return `You are evaluating Stage 2 (Supervised Training) for "${brandName}".

Test scenario results (need 25/25 = 100% to pass):
- Passed: ${passed}/${total} (${pct}%)
- Failed: ${failed}
- Not yet scored: ${unscored}

Results by set:
${setCounts}

Knowledge base documents:
${docList}

Brand tone: ${fmt(config.tone)}
Target audience: ${fmt(config.target_audience)}

Evaluate:
1. Is the agent on track to meet the 100% pass threshold? ${pct === 100 ? 'Currently passing.' : `Currently ${pct}% — needs ${25 - passed} more passes.`}
2. Which test sets are weakest and why?
3. Is the knowledge base sufficient to support the scenarios being tested?
4. What specific areas need improvement before advancing?

Score 1-10. Give 10 if all criteria are genuinely met — do not lower the score just to justify recommendations.
If score is 10, recommendations may be empty. If score is below 10, give as many specific actionable recommendations as needed to address all identified issues.
Respond ONLY with JSON: { "score": <1-10>, "ready": <true if score >= 10>, "recommendations": [] }`
}

function buildStage3Prompt(brandName, config, validationResults) {
  const w1 = validationResults?.week1 ?? {}
  const w2 = validationResults?.week2 ?? {}

  const weekSummary = (label, week) => {
    if (!week.date && !week.notes) return `${label}: Not started`
    return `${label}:
  Status: ${week.passed === true ? 'PASSED' : week.passed === false ? 'FAILED' : 'Not evaluated'}
  Date: ${week.date || 'not set'}
  Notes: ${week.notes?.trim() ? `"${week.notes.trim()}"` : 'No notes written'}`
  }

  return `You are evaluating Stage 3 (Probation) for "${brandName}".

Both weeks must pass to complete this stage.

${weekSummary('Week 1', w1)}

${weekSummary('Week 2', w2)}

Brand voice reference:
- Tone: ${fmt(config.tone)}
- Prohibited topics: ${fmt(config.prohibited_topics)}
- Escalation triggers: ${fmt(config.escalation_triggers)}

Evaluate:
1. Have both probation weeks been properly reviewed and passed?
2. Are the review notes substantive — do they describe specific outputs reviewed, or are they vague/placeholder?
3. Do the notes reflect real brand voice monitoring (tone adherence, prohibited topics respected, escalation handling)?
4. What should be reviewed more rigorously before advancing?

Score 1-10. Give 10 if all criteria are genuinely met — do not lower the score just to justify recommendations.
If score is 10, recommendations may be empty. If score is below 10, give as many specific actionable recommendations as needed to address all identified issues.
Respond ONLY with JSON: { "score": <1-10>, "ready": <true if score >= 10>, "recommendations": [] }`
}

function buildStage4Prompt(brandName, config, validationResults) {
  const tests = [
    { id: 'test1', label: 'Write a Brand Caption',       desc: 'Agent writes a social media caption matching brand voice.' },
    { id: 'test2', label: 'Identify Brand Violations',   desc: 'Agent reviews content and flags BRR violations.' },
    { id: 'test3', label: 'Explain Brand Philosophy',    desc: 'Agent explains brand soul and core promise in its own words.' },
  ]

  const testSummary = tests.map(t => {
    const result = validationResults?.[t.id] ?? {}
    return `${t.label}:
  Status: ${result.passed === true ? 'PASSED' : result.passed === false ? 'FAILED' : 'Not attempted'}
  Agent output: ${result.output?.trim() ? `"${result.output.trim().slice(0, 300)}${result.output.length > 300 ? '…' : ''}"` : 'None provided'}
  Evaluator notes: ${result.evaluator_notes?.trim() || 'None'}`
  }).join('\n\n')

  return `You are evaluating Stage 4 (Certification) for "${brandName}".

All 3 certification tests must pass.

${testSummary}

Brand voice reference:
- Tone: ${fmt(config.tone)}
- Response style: ${fmt(config.response_style)}
- Brand promise: ${fmt(config.promise)}
- Core values: ${fmt(config.key_values)}
- Prohibited topics: ${fmt(config.prohibited_topics)}

Evaluate:
1. Do the agent outputs genuinely reflect the brand's tone, values, and promise?
2. For any passed tests: are the outputs strong enough to justify certification?
3. For any failed or missing tests: what specifically needs to improve?
4. Is the evaluator's judgment (notes) rigorous, or are tests being passed too easily?

Score 1-10. Give 10 if all criteria are genuinely met — do not lower the score just to justify recommendations.
If score is 10, recommendations may be empty. If score is below 10, give as many specific actionable recommendations as needed to address all identified issues.
Respond ONLY with JSON: { "score": <1-10>, "ready": <true if score >= 10>, "recommendations": [] }`
}

function buildStage5Prompt(brandName, config, validationResults) {
  const spotChecks = validationResults?.spot_checks ?? []
  const passed = spotChecks.filter(c => c.passed === true).length
  const failed = spotChecks.filter(c => c.passed === false).length

  const checkList = spotChecks.length > 0
    ? spotChecks.map((c, i) =>
        `  Check ${i + 1}: ${c.date || 'no date'} — ${c.passed === true ? 'PASS' : c.passed === false ? 'FAIL' : 'unscored'} — "${c.notes?.trim() || 'no notes'}"`
      ).join('\n')
    : '  No spot checks logged yet'

  return `You are evaluating Stage 5 (Deployment) for "${brandName}".

Deployment date: ${validationResults?.deployed_date || 'NOT SET'}

Weekly spot-checks (${spotChecks.length} logged, ${passed} passed, ${failed} failed):
${checkList}

Monthly review notes:
${validationResults?.monthly_review?.trim() ? `"${validationResults.monthly_review.trim()}"` : 'Not written yet'}

Brand guardrails to monitor:
- Prohibited topics: ${fmt(config.prohibited_topics)}
- Escalation triggers: ${fmt(config.escalation_triggers)}
- Tone: ${fmt(config.tone)}

Evaluate:
1. Is the deployment date recorded?
2. Are spot checks being conducted regularly and with meaningful notes?
3. Do the notes show active monitoring of brand voice, prohibited topics, and escalation handling?
4. Does the monthly review summarise performance trends, not just state "all good"?

Score 1-10. Give 10 if all criteria are genuinely met — do not lower the score just to justify recommendations.
If score is 10, recommendations may be empty. If score is below 10, give as many specific actionable recommendations as needed to address all identified issues.
Respond ONLY with JSON: { "score": <1-10>, "ready": <true if score >= 10>, "recommendations": [] }`
}

function buildStage6Prompt(brandName, config, validationResults) {
  const updates = validationResults?.brr_updates ?? []

  const updateList = updates.length > 0
    ? updates.map((u, i) =>
        `  Update ${i + 1}: v${u.version || '?'} on ${u.date || 'no date'} — "${u.description?.trim() || 'no description'}"`
      ).join('\n')
    : '  No BRR updates logged yet'

  return `You are evaluating Stage 6 (Ongoing Learning) for "${brandName}".

BRR update log (${updates.length} updates):
${updateList}

Re-training notes:
${validationResults?.retraining_notes?.trim() ? `"${validationResults.retraining_notes.trim()}"` : 'Not written yet'}

Current brand config summary:
- Tone: ${fmt(config.tone)}
- Brand promise: ${fmt(config.promise)}
- Core values: ${fmt(config.key_values)}

Evaluate:
1. Are BRR updates being logged with enough detail (version, date, what changed and why)?
2. Do the updates reflect real brand evolution, not just cosmetic tweaks?
3. Are re-training cycles being triggered when the BRR changes, and are the notes substantive?
4. Is this brand keeping its AI agent current with how the brand actually operates?

Score 1-10. Give 10 if all criteria are genuinely met — do not lower the score just to justify recommendations.
If score is 10, recommendations may be empty. If score is below 10, give as many specific actionable recommendations as needed to address all identified issues.
Respond ONLY with JSON: { "score": <1-10>, "ready": <true if score >= 10>, "recommendations": [] }`
}

// ─── Route handler ────────────────────────────────────────────────────────────

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

  // Fetch all context in parallel
  const [configResult, stageResult, knowledgeResult, scenariosResult] = await Promise.all([
    supabase.from('brand_configs').select('config').eq('brand_id', owned.brand_id).single(),
    supabase.from('training_progress').select('validation_results, test_scores').eq('agent_id', agentId).eq('stage', stageNum).single(),
    supabase.from('brand_knowledge').select('title, content').eq('brand_id', owned.brand_id),
    stageNum === 2
      ? supabase.from('test_scenarios').select('test_set, scenario_number, input_prompt').eq('brand_id', owned.brand_id).order('test_set').order('scenario_number')
      : Promise.resolve({ data: [] }),
  ])

  const config            = configResult.data?.config ?? {}
  const validationResults = stageResult.data?.validation_results ?? {}
  const testScores        = stageResult.data?.test_scores ?? {}
  const knowledgeDocs     = knowledgeResult.data ?? []
  const scenarios         = scenariosResult.data ?? []

  const brandName = owned.brands.name

  const prompts = {
    1: () => buildStage1Prompt(brandName, config),
    2: () => buildStage2Prompt(brandName, config, testScores, scenarios, knowledgeDocs),
    3: () => buildStage3Prompt(brandName, config, validationResults),
    4: () => buildStage4Prompt(brandName, config, validationResults),
    5: () => buildStage5Prompt(brandName, config, validationResults),
    6: () => buildStage6Prompt(brandName, config, validationResults),
  }

  const userMessage = prompts[stageNum]()

  let evaluationResponse
  try {
    evaluationResponse = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system: 'You are an expert brand AI training evaluator. Assess agent readiness based on the specific stage criteria provided. Respond only with valid JSON.',
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
    const ready = Boolean(parsed.ready ?? score >= 10)
    const recommendations = Array.isArray(parsed.recommendations)
      ? parsed.recommendations.map(String)
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
