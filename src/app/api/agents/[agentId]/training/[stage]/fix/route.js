import { getUserFromRequest, getAdminClient, dbError } from '@/lib/supabase-server'
import { anthropic, isAnthropicConfigured } from '@/lib/anthropic'

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

// ─── Stage-specific fix prompt builders ──────────────────────────────────────

function buildStage1Fix(brandName, config, recommendations = []) {
  const KEY_FIELDS = [
    { field: 'physique',             label: 'Visual identity / physique' },
    { field: 'tagline',              label: 'Tagline or slogan' },
    { field: 'signature_products',   label: 'Signature products or services' },
    { field: 'personality_traits',   label: 'Character traits' },
    { field: 'tone',                 label: 'Tone of voice' },
    { field: 'response_style',       label: 'Response style' },
    { field: 'promise',              label: 'Brand promise / soul' },
    { field: 'key_values',           label: 'Core values' },
    { field: 'culture_beliefs',      label: 'Beliefs & principles' },
    { field: 'culture_origin',       label: 'Origin & mission' },
    { field: 'relationship_type',    label: 'Relationship type' },
    { field: 'escalation_triggers',  label: 'Escalation triggers' },
    { field: 'prohibited_topics',    label: 'Prohibited topics' },
    { field: 'target_audience',      label: 'Target audience' },
    { field: 'reflection_archetype', label: 'Customer archetype' },
    { field: 'customer_values',      label: 'Customer values' },
    { field: 'selfimage_feeling',    label: 'How customers feel' },
    { field: 'selfimage_aspiration', label: 'Aspiration fulfilled' },
    { field: 'response_guidelines',  label: 'AI response guidelines' },
  ]

  const fieldSummary = KEY_FIELDS.map(({ field, label }) => {
    const raw = config[field]?.trim?.() ?? ''
    const val = raw.length > 200 ? raw.slice(0, 200) + '…' : raw
    return `  ${label} (${field}): ${val ? `"${val}"` : 'EMPTY'}`
  }).join('\n')

  const evalSection = recommendations.length > 0
    ? `\nEvaluation flagged these specific issues to fix:\n${recommendations.map((r, i) => `  ${i + 1}. ${r}`).join('\n')}\nPrioritise addressing these issues in your changes.\n`
    : ''

  const scopeRule = recommendations.length > 0
    ? `Your task — for each field decide:
1. If EMPTY: generate specific, realistic content based on the brand name and existing context
2. If flagged by the evaluation above: improve it to address the specific issue
3. Otherwise: skip it — do not include it in changes`
    : `Your task — for each field decide:
1. If EMPTY: generate specific, realistic content based on the brand name and existing context
2. If the value is fewer than 8 words or is clearly a placeholder (e.g. "TBD", "N/A", a single adjective with no context): improve it
3. If the field already has substantial, specific content: skip it — do not include it in changes
IMPORTANT: If all fields already contain substantial content, return an empty changes array with summary "All fields are already complete — run Evaluate with AI to get specific improvement recommendations."`

  return `You are an expert brand strategist improving the brand configuration for "${brandName}".

Current brand configuration:
${fieldSummary}
${evalSection}
${scopeRule}

Quality standards:
- "prohibited_topics": must list concrete scenarios (e.g. "Do not discuss competitor pricing; do not make delivery guarantees; do not process refund requests on worn items")
- "escalation_triggers": must include specific situations AND define agent authority (e.g. "Order lost after 14 days → request photo evidence then escalate; customer mentions chargeback → auto-escalate, do not negotiate")
- "tone": must describe voice with adjectives and examples, not just a single word
- "relationship_type": describe HOW the brand builds loyalty (community, repeat purchase incentives, peer recommendations, etc.)
- "escalation_triggers" and "prohibited_topics" together are the most critical AI guardrails — make them very specific

Respond ONLY with JSON in this exact format:
{
  "summary": "Brief description of what was improved or added",
  "changes": [
    { "label": "Field label", "field": "field_key", "from": "current value or null", "to": "improved content" }
  ],
  "patch": {
    "type": "brand_config",
    "config": { "field_key": "improved content" }
  }
}`
}

function buildStage2Fix(brandName, config, testScores, scenarios, recommendations = [], scenarioKey = null) {
  const scenarioMap = {}
  scenarios.forEach(s => { scenarioMap[`${s.test_set}${s.scenario_number}`] = s })

  // Single-scenario mode
  if (scenarioKey) {
    const scenario = scenarioMap[scenarioKey]
    const currentScore = testScores[scenarioKey] || null
    const criteria = scenario?.evaluation_criteria
      ? `\nEvaluation criteria: ${typeof scenario.evaluation_criteria === 'string' ? scenario.evaluation_criteria : JSON.stringify(scenario.evaluation_criteria)}`
      : ''
    const goodEx = scenario?.good_example ? `\nGood example response: "${scenario.good_example}"` : ''
    const badEx  = scenario?.bad_example  ? `\nBad example response: "${scenario.bad_example}"`  : ''
    return `You are evaluating a single test scenario for brand AI agent "${brandName}".

Brand context:
- Tone: ${config.tone || 'not defined'}
- Target audience: ${config.target_audience || 'not defined'}
- Prohibited topics: ${config.prohibited_topics || 'not defined'}

Scenario ${scenarioKey}: ${scenario?.input_prompt ? `"${scenario.input_prompt}"` : '(no prompt added yet)'}${criteria}${goodEx}${badEx}
Current score: ${currentScore || 'not yet scored'}

Based on the scenario prompt, evaluation criteria, and brand context, decide whether a well-configured brand-aligned AI agent would pass or fail this scenario:
- pass — straightforward for a well-configured agent matching this brand
- fail — complex, edge-case, or beyond what the brand config covers

CRITICAL: You must choose either "pass" or "fail" based on your judgment. Do NOT default to "pass". If the brand config is missing key context for this scenario, choose "fail".

Respond ONLY with JSON, replacing <YOUR_DECISION> with your chosen value (literally "pass" or "fail"):
{
  "summary": "<one-sentence reason for your decision>",
  "changes": [{ "label": "Scenario ${scenarioKey}", "field": "${scenarioKey}", "from": ${currentScore ? `"${currentScore}"` : 'null'}, "to": "<YOUR_DECISION>" }],
  "patch": { "type": "training_progress", "test_scores": { "${scenarioKey}": "<YOUR_DECISION>" } }
}`
  }

  // Bulk mode — score all unscored scenarios
  const unscored = []
  const sets = { A: 6, B: 6, C: 5, D: 3, E: 5 }
  for (const [set, count] of Object.entries(sets)) {
    for (let i = 1; i <= count; i++) {
      const key = `${set}${i}`
      if (!testScores[key]) {
        const scenario = scenarioMap[key]
        unscored.push({ key, prompt: scenario?.input_prompt || null })
      }
    }
  }

  if (unscored.length === 0) {
    return null // nothing to fix
  }

  const evalSection = recommendations.length > 0
    ? `\nEvaluation flagged these issues:\n${recommendations.map((r, i) => `  ${i + 1}. ${r}`).join('\n')}\n`
    : ''

  return `You are evaluating test scenarios for brand AI agent "${brandName}".
${evalSection}
Brand tone: ${config.tone || 'not defined'}
Target audience: ${config.target_audience || 'not defined'}
Prohibited topics: ${config.prohibited_topics || 'not defined'}

The following scenarios have not been scored yet. For each one, decide pass or fail:
- pass — straightforward for a well-configured agent matching this brand
- fail — complex, edge-case, missing prompt, or beyond what the brand config covers

CRITICAL: Make a real judgment for each scenario. Do NOT default to "pass" for everything. Scenarios with no prompt should be "fail".

Unscored scenarios:
${unscored.map(u => `  ${u.key}: ${u.prompt ? `"${u.prompt}"` : '(no prompt added yet)'}`).join('\n')}

Respond ONLY with JSON. The "to" values and "test_scores" values must each be either "pass" or "fail" based on YOUR judgment:
{
  "summary": "Scored X unscored scenarios — N pass, M fail",
  "changes": [
    { "label": "Scenario A1", "field": "A1", "from": null, "to": "pass" }
  ],
  "patch": {
    "type": "training_progress",
    "test_scores": { "A1": "pass", "B2": "fail" }
  }
}`
}

function buildStage3Fix(brandName, config, validationResults, recommendations = []) {
  const w1 = validationResults?.week1 ?? {}
  const w2 = validationResults?.week2 ?? {}
  const today = new Date().toISOString().split('T')[0]
  const lastWeek = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]

  const evalSection = recommendations.length > 0
    ? `\nEvaluation flagged these issues to address:\n${recommendations.map((r, i) => `  ${i + 1}. ${r}`).join('\n')}\n`
    : ''

  return `You are writing probation review notes for brand AI agent "${brandName}".
${evalSection}
Brand voice:
- Tone: ${config.tone || 'not defined'}
- Prohibited topics: ${config.prohibited_topics || 'not defined'}
- Escalation triggers: ${config.escalation_triggers || 'not defined'}
- Target audience: ${config.target_audience || 'not defined'}

Current week 1 status: ${w1.passed === true ? 'passed' : w1.passed === false ? 'failed' : 'not reviewed'}
Current week 1 notes: ${w1.notes?.trim() || 'empty'}
Current week 2 status: ${w2.passed === true ? 'passed' : w2.passed === false ? 'failed' : 'not reviewed'}
Current week 2 notes: ${w2.notes?.trim() || 'empty'}

Generate realistic, specific probation review notes for any week that has no notes yet.
Notes should describe:
- What customer conversations were sampled
- Whether tone matched the brand guidelines
- Whether any prohibited topics were triggered
- Whether escalations were handled correctly
- An overall verdict

Respond ONLY with JSON in this exact format:
{
  "summary": "Generated probation review notes for missing weeks",
  "changes": [
    { "label": "Week 1 review notes", "field": "week1.notes", "from": null, "to": "suggested notes" },
    { "label": "Week 1 status", "field": "week1.passed", "from": null, "to": true }
  ],
  "patch": {
    "type": "training_progress",
    "validation_results": {
      "week1": { "passed": true, "date": "${lastWeek}", "notes": "..." },
      "week2": { "passed": true, "date": "${today}", "notes": "..." }
    }
  }
}`
}

function buildStage4Fix(brandName, config, validationResults, recommendations = []) {
  const tests = [
    { id: 'test1', label: 'Write a Brand Caption', desc: 'Write a social media caption that matches brand voice and guidelines.' },
    { id: 'test2', label: 'Identify Brand Violations', desc: 'Review 3 pieces of content and flag what violates the brand guidelines.' },
    { id: 'test3', label: 'Explain Brand Philosophy', desc: 'Explain the brand soul and core promise in your own words.' },
  ]

  const missing = tests.filter(t => !validationResults?.[t.id]?.output?.trim())
  const evalSection = recommendations.length > 0
    ? `\nEvaluation flagged these issues to address:\n${recommendations.map((r, i) => `  ${i + 1}. ${r}`).join('\n')}\n`
    : ''

  return `You are generating sample certification test outputs for brand AI agent "${brandName}".
${evalSection}
Brand configuration:
- Tone: ${config.tone || 'not defined'}
- Response style: ${config.response_style || 'not defined'}
- Brand promise: ${config.promise || 'not defined'}
- Core values: ${config.key_values || 'not defined'}
- Prohibited topics: ${config.prohibited_topics || 'not defined'}
- Target audience: ${config.target_audience || 'not defined'}

Generate realistic agent outputs for the following missing certification tests.
The outputs should genuinely reflect the brand voice and show mastery of the brand guidelines.

Missing tests:
${missing.map(t => `  ${t.id}: ${t.label} — ${t.desc}`).join('\n')}

Respond ONLY with JSON in this exact format:
{
  "summary": "Generated sample outputs for X certification tests",
  "changes": [
    { "label": "Test 1: Write a Brand Caption — output", "field": "test1.output", "from": null, "to": "..." },
    { "label": "Test 1: Evaluator notes", "field": "test1.evaluator_notes", "from": null, "to": "..." }
  ],
  "patch": {
    "type": "training_progress",
    "validation_results": {
      "test1": { "passed": true, "output": "...", "evaluator_notes": "..." },
      "test2": { "passed": true, "output": "...", "evaluator_notes": "..." },
      "test3": { "passed": true, "output": "...", "evaluator_notes": "..." }
    }
  }
}`
}

function buildStage5Fix(brandName, config, validationResults, recommendations = []) {
  const today = new Date().toISOString().split('T')[0]
  const evalSection = recommendations.length > 0
    ? `\nEvaluation flagged these issues to address:\n${recommendations.map((r, i) => `  ${i + 1}. ${r}`).join('\n')}\n`
    : ''

  return `You are generating a spot-check entry for deployed brand AI agent "${brandName}".
${evalSection}
Brand guardrails:
- Tone: ${config.tone || 'not defined'}
- Prohibited topics: ${config.prohibited_topics || 'not defined'}
- Escalation triggers: ${config.escalation_triggers || 'not defined'}

Current spot checks logged: ${(validationResults?.spot_checks ?? []).length}
Current monthly review: ${validationResults?.monthly_review?.trim() || 'not written'}

Generate:
1. A realistic weekly spot-check entry with specific notes about what was reviewed
2. A monthly review summary if not yet written

The spot check notes should mention specific types of conversations reviewed, any issues found, and a verdict.

Respond ONLY with JSON in this exact format:
{
  "summary": "Generated a spot-check entry and monthly review",
  "changes": [
    { "label": "New spot check (${today})", "field": "spot_checks", "from": null, "to": "Pass — reviewed 12 conversations..." },
    { "label": "Monthly review", "field": "monthly_review", "from": null, "to": "..." }
  ],
  "patch": {
    "type": "training_progress",
    "validation_results": {
      "deployed_date": "${validationResults?.deployed_date || today}",
      "spot_checks": ${JSON.stringify([...(validationResults?.spot_checks ?? []), { date: today, passed: true, notes: '...' }])},
      "monthly_review": "..."
    }
  }
}`
}

function buildStage6Fix(brandName, config, validationResults, recommendations = []) {
  const today = new Date().toISOString().split('T')[0]
  const existingUpdates = validationResults?.brr_updates ?? []
  const nextVersion = existingUpdates.length > 0
    ? `1.${existingUpdates.length + 1}`
    : '1.1'
  const evalSection = recommendations.length > 0
    ? `\nEvaluation flagged these issues to address:\n${recommendations.map((r, i) => `  ${i + 1}. ${r}`).join('\n')}\n`
    : ''

  return `You are logging a BRR (Brand Road Rules) update for brand AI agent "${brandName}".
${evalSection}

Current brand configuration:
- Tone: ${config.tone || 'not defined'}
- Core values: ${config.key_values || 'not defined'}
- Brand promise: ${config.promise || 'not defined'}

Existing BRR updates logged: ${existingUpdates.length}
${existingUpdates.map((u, i) => `  v${u.version} (${u.date}): ${u.description}`).join('\n') || '  None'}

Current re-training notes: ${validationResults?.retraining_notes?.trim() || 'not written'}

Generate:
1. A realistic BRR update entry (version ${nextVersion}) describing a typical brand guideline refinement
2. Re-training notes if not yet written

Respond ONLY with JSON in this exact format:
{
  "summary": "Generated BRR update v${nextVersion} and re-training notes",
  "changes": [
    { "label": "BRR Update v${nextVersion}", "field": "brr_updates", "from": null, "to": "Refined tone guidance to..." },
    { "label": "Re-training notes", "field": "retraining_notes", "from": null, "to": "..." }
  ],
  "patch": {
    "type": "training_progress",
    "validation_results": {
      "brr_updates": ${JSON.stringify([...existingUpdates, { date: today, version: nextVersion, description: '...' }])},
      "retraining_notes": "..."
    }
  }
}`
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req, { params }) {
  if (!isAnthropicConfigured()) {
    return Response.json({ error: 'AI fix is not available — ANTHROPIC_API_KEY is not configured' }, { status: 503 })
  }

  const [user, body, { agentId, stage }] = await Promise.all([
    getUserFromRequest(req),
    req.text().then(t => t ? JSON.parse(t) : {}).catch(() => null),
    params,
  ])
  if (body === null) {
    return Response.json({ error: 'Invalid JSON in request body' }, { status: 400 })
  }
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const stageNum = parseInt(stage, 10)
  if (isNaN(stageNum) || stageNum < 1 || stageNum > 6) {
    return Response.json({ error: 'stage must be between 1 and 6' }, { status: 400 })
  }

  const supabase = getAdminClient()
  const owned = await assertAgentOwner(supabase, agentId, user.id)
  if (!owned) return Response.json({ error: 'Agent not found' }, { status: 404 })

  const [configResult, stageResult, scenariosResult] = await Promise.all([
    supabase.from('brand_configs').select('config').eq('brand_id', owned.brand_id).single(),
    supabase.from('training_progress').select('validation_results, test_scores').eq('agent_id', agentId).eq('stage', stageNum).single(),
    stageNum === 2
      ? supabase.from('test_scenarios').select('test_set, scenario_number, input_prompt, good_example, bad_example, evaluation_criteria').eq('brand_id', owned.brand_id).order('test_set').order('scenario_number')
      : Promise.resolve({ data: [] }),
  ])

  const config            = configResult.data?.config ?? {}
  const validationResults = stageResult.data?.validation_results ?? {}
  const testScores        = stageResult.data?.test_scores ?? {}
  const scenarios         = scenariosResult.data ?? []
  const brandName         = owned.brands.name
  const brandId           = owned.brand_id

  const recommendations = Array.isArray(body?.recommendations) ? body.recommendations.map(String) : []
  const scenarioKey = typeof body?.scenario === 'string' ? body.scenario : null

  const promptBuilders = {
    1: () => buildStage1Fix(brandName, config, recommendations),
    2: () => buildStage2Fix(brandName, config, testScores, scenarios, recommendations, scenarioKey),
    3: () => buildStage3Fix(brandName, config, validationResults, recommendations),
    4: () => buildStage4Fix(brandName, config, validationResults, recommendations),
    5: () => buildStage5Fix(brandName, config, validationResults, recommendations),
    6: () => buildStage6Fix(brandName, config, validationResults, recommendations),
  }

  const userMessage = promptBuilders[stageNum]()

  if (!userMessage) {
    return Response.json({ message: 'Nothing to fix — all data is already complete.', changes: [], patch: null })
  }

  let aiResponse
  try {
    aiResponse = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 6000,
      system: 'You are an expert brand AI training assistant. Generate specific, realistic content to fill in missing training data. Respond only with valid JSON. Keep each suggested value concise (1-3 sentences max).',
      messages: [{ role: 'user', content: userMessage }],
    })
  } catch (err) {
    console.error('[fix] Anthropic error:', err?.message)
    return Response.json({ error: 'AI fix failed — please try again' }, { status: 502 })
  }

  const rawText = aiResponse.content[0]?.text ?? ''

  try {
    const parsed = parseAnthropicJson(rawText)
    let patch = parsed.patch ?? null

    // Stage 2: scrub non-pass/fail values from test_scores patches (LLM safety net)
    if (stageNum === 2 && patch?.test_scores) {
      const cleaned = {}
      for (const [k, v] of Object.entries(patch.test_scores)) {
        const val = String(v).toLowerCase().trim()
        if (val === 'pass' || val === 'fail') cleaned[k] = val
      }
      if (Object.keys(cleaned).length === 0) {
        return Response.json({ error: 'AI returned invalid scores — please try again' }, { status: 502 })
      }
      patch = { ...patch, test_scores: cleaned }
    }

    return Response.json({
      summary: String(parsed.summary ?? 'AI suggested changes'),
      changes: Array.isArray(parsed.changes) ? parsed.changes : [],
      patch,
      brandId,
    })
  } catch {
    console.error('[fix] parse error. Raw:', rawText)
    return Response.json({ error: 'AI returned an unexpected response. Please try again.' }, { status: 502 })
  }
}
