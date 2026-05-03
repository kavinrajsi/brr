#!/usr/bin/env node
/**
 * Stage 2 smoke test — exercises the critical paths end-to-end against a running dev server.
 *
 * Setup:
 *   1. Start the dev server: `npm run dev`
 *   2. Open the app in your browser, sign in
 *   3. Open DevTools → Application → Local Storage → http://localhost:3000
 *   4. Find the key starting with `sb-` and ending in `-auth-token`. Copy the `access_token` value
 *   5. Open a Stage 2 page, copy the `brandId` and `agentId` from the URL
 *
 * Run:
 *   BRAND_ID=... AGENT_ID=... TOKEN=... node scripts/smoke-stage2.mjs
 *
 * Optional:
 *   BASE=http://localhost:3000   # defaults to localhost:3000
 *   SCENARIO_KEY=A1              # defaults to first scenario found
 */

const BASE     = process.env.BASE || 'http://localhost:3000'
const TOKEN    = process.env.TOKEN
const BRAND_ID = process.env.BRAND_ID
const AGENT_ID = process.env.AGENT_ID
const SCENARIO_OVERRIDE = process.env.SCENARIO_KEY

if (!TOKEN || !BRAND_ID || !AGENT_ID) {
  console.error('Missing required env: TOKEN, BRAND_ID, AGENT_ID')
  console.error('See header of this file for setup instructions.')
  process.exit(1)
}

const HEADERS = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }

// ─── Pretty output ──────────────────────────────────────────────────────────
const c = { reset: '\x1b[0m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', dim: '\x1b[2m' }
let passed = 0, failed = 0
function ok(msg, detail = '')  { console.log(`${c.green}✓${c.reset} ${msg}${detail ? c.dim + ' — ' + detail + c.reset : ''}`); passed++ }
function bad(msg, detail = '') { console.log(`${c.red}✗${c.reset} ${msg}${detail ? c.dim + ' — ' + detail + c.reset : ''}`); failed++ }
function info(msg)             { console.log(`${c.cyan}ℹ${c.reset} ${msg}`) }
function section(name)         { console.log(`\n${c.yellow}── ${name} ──${c.reset}`) }

async function http(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: HEADERS,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = text }
  return { status: res.status, data }
}

// ─── Tests ─────────────────────────────────────────────────────────────────

async function checkAgent() {
  section('Agent ownership + status')
  const { status, data } = await http('GET', `/api/agents/${AGENT_ID}`)
  if (status === 200 && data?.id === AGENT_ID) {
    ok('agent fetch works', `status=${data.status}, current_stage=${data.current_stage}`)
    return data
  }
  bad('agent fetch failed', `status=${status} body=${JSON.stringify(data).slice(0, 120)}`)
  return null
}

async function checkScenarios() {
  section('Scenarios fetch')
  const { status, data } = await http('GET', `/api/brands/${BRAND_ID}/scenarios`)
  if (status === 200 && Array.isArray(data)) {
    ok('scenarios fetch works', `${data.length} scenarios in DB`)
    if (data.length === 0) info('no scenarios in DB — Stage 2 will show empty defaults')
    return data
  }
  bad('scenarios fetch failed', `status=${status}`)
  return []
}

async function checkStage2State() {
  section('Stage 2 training_progress fetch')
  const { status, data } = await http('GET', `/api/agents/${AGENT_ID}/training/2`)
  if (status === 200) {
    const numScored = Object.keys(data?.test_scores ?? {}).length
    ok('stage 2 GET works', `status=${data.status}, ${numScored} scenarios scored`)
    return data
  }
  bad('stage 2 GET failed', `status=${status}`)
  return null
}

async function checkPerScenarioFix(scenarioKey) {
  section(`Per-scenario AI fix (scenario ${scenarioKey})`)
  const { status, data } = await http('POST', `/api/agents/${AGENT_ID}/training/2/fix`, { scenario: scenarioKey })

  if (status !== 200) {
    bad('fix endpoint failed', `status=${status} body=${JSON.stringify(data).slice(0, 200)}`)
    return null
  }
  ok('fix endpoint returned 200')

  const score = data?.patch?.test_scores?.[scenarioKey]
  if (score === 'pass' || score === 'fail') {
    ok('AI returned a real pass/fail decision', `→ "${score}"`)
  } else {
    bad('AI returned invalid score', `got: ${JSON.stringify(score)}`)
  }

  if (typeof data?.summary === 'string' && data.summary.length > 0) {
    ok('AI returned a reason', `"${data.summary.slice(0, 80)}"`)
  } else {
    bad('AI did not return a summary')
  }

  if (Array.isArray(data?.changes) && data.changes.length === 1) {
    ok('changes array has 1 entry for single-scenario mode')
  } else {
    bad('expected 1 change in single-scenario mode', `got ${data?.changes?.length}`)
  }

  return data
}

async function checkBulkFix() {
  section('Bulk Analyse & Fix (no scenario param)')
  const { status, data } = await http('POST', `/api/agents/${AGENT_ID}/training/2/fix`, {})

  if (status !== 200) {
    bad('bulk fix failed', `status=${status}`)
    return
  }
  ok('bulk fix endpoint returned 200')

  if (data?.patch === null) {
    info('all scenarios already scored — bulk returned no changes (correct behaviour)')
  } else if (data?.patch?.test_scores) {
    const entries = Object.entries(data.patch.test_scores)
    const allValid = entries.every(([, v]) => v === 'pass' || v === 'fail')
    if (allValid) {
      ok(`bulk returned valid scores for ${entries.length} scenarios`)
    } else {
      bad('bulk returned non-pass/fail values', `${JSON.stringify(data.patch.test_scores).slice(0, 200)}`)
    }
  }
}

async function checkEvaluate() {
  section('Evaluate Stage 2')
  const { status, data } = await http('POST', `/api/agents/${AGENT_ID}/training/2/evaluate`, {})
  if (status !== 200) {
    bad('evaluate failed', `status=${status}`)
    return
  }
  if (typeof data?.score === 'number' && data.score >= 1 && data.score <= 10) {
    ok('evaluate returned valid score', `${data.score}/10, ready=${data.ready}`)
  } else {
    bad('evaluate returned invalid score', `got: ${JSON.stringify(data?.score)}`)
  }
  if (Array.isArray(data?.recommendations)) {
    ok(`evaluate returned ${data.recommendations.length} recommendations`)
  } else {
    bad('recommendations is not an array')
  }
}

async function checkChatDuringTraining(agent) {
  section('Chat API allows owner during training')
  const { status, data } = await http('POST', `/api/agents/${AGENT_ID}/chat`, { message: 'ping' })
  if (status === 200) {
    ok('chat returned 200 (streaming response)')
  } else if (status === 403 && (agent?.status === 'Deployed' || agent?.status === 'Certified')) {
    bad('chat unexpectedly 403 — agent is live, owner should be allowed')
  } else if (status === 403) {
    bad('chat returned 403 — owner-during-training rule is broken', `(agent.status=${agent?.status})`)
  } else {
    bad('chat unexpected status', `status=${status} body=${JSON.stringify(data).slice(0, 120)}`)
  }
}

async function checkStageGate(agent) {
  section('Stage gate (PUT requires current_stage)')
  // Try to update stage 6 (likely not the current stage) — should 403
  const targetStage = agent.current_stage === 6 ? 1 : 6
  const { status } = await http('PUT', `/api/agents/${AGENT_ID}/training/${targetStage}`, {
    test_scores: { TEST: 'pass' },
  })
  if (status === 403) {
    ok(`PUT to non-current stage ${targetStage} correctly blocked with 403`)
  } else {
    bad(`PUT to non-current stage ${targetStage} returned ${status} (expected 403)`)
  }
}

// ─── Run ───────────────────────────────────────────────────────────────────

console.log(`${c.cyan}Stage 2 smoke test${c.reset}`)
console.log(`${c.dim}base=${BASE} brand=${BRAND_ID} agent=${AGENT_ID}${c.reset}`)

const agent = await checkAgent()
if (!agent) { console.log(`\n${c.red}Stopping — cannot reach agent.${c.reset}`); process.exit(1) }

const scenarios = await checkScenarios()
await checkStage2State()

const scenarioKey = SCENARIO_OVERRIDE
  || (scenarios[0] ? `${scenarios[0].test_set}${scenarios[0].scenario_number}` : 'A1')

if (scenarios.length > 0) {
  await checkPerScenarioFix(scenarioKey)
  await checkBulkFix()
  await checkEvaluate()
} else {
  info('skipping AI fix/evaluate — no scenarios to test against')
}

await checkChatDuringTraining(agent)
await checkStageGate(agent)

console.log(`\n${c.cyan}Result:${c.reset} ${c.green}${passed} passed${c.reset}, ${failed > 0 ? c.red : c.dim}${failed} failed${c.reset}`)
process.exit(failed > 0 ? 1 : 0)
