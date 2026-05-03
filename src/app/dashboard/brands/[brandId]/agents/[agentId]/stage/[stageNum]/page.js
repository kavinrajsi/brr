'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useTraining } from '@/hooks/useTraining'
import { apiCall } from '@/lib/api-client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import Link from 'next/link'

// ─── Stage 1: Onboarding ────────────────────────────────────────────────────

const ONBOARDING_CHECKS = [
  {
    id: 'brand_name',
    label: 'Brand name and identity confirmed',
    hint: 'Set your brand name and short name when creating the brand.',
    verify: (brand, cfg) => !!(brand?.name?.trim() && brand?.short_name?.trim()),
  },
  {
    id: 'brr_complete',
    label: 'Brand Road Rules (BRR) configuration completed',
    hint: 'At least one field in each of the 6 Brand Prism facets must be filled.',
    verify: (brand, cfg) => {
      const facets = [
        ['physique', 'tagline', 'signature_products'],
        ['personality_traits', 'tone', 'response_style'],
        ['promise', 'key_values', 'culture_beliefs'],
        ['relationship_type', 'escalation_triggers', 'prohibited_topics'],
        ['target_audience', 'reflection_archetype', 'customer_values'],
        ['selfimage_feeling', 'selfimage_aspiration'],
      ]
      return facets.every(fields => fields.some(f => cfg?.[f]?.trim?.()))
    },
  },
  {
    id: 'tone_defined',
    label: 'Tone of voice and personality defined',
    hint: 'Fill in Tone of Voice and Response Style in Configure Brand → Personality.',
    verify: (brand, cfg) => !!(cfg?.tone?.trim() && cfg?.response_style?.trim()),
  },
  {
    id: 'promise_set',
    label: 'Core promise and brand soul established',
    hint: 'Fill in Brand Promise and Core Values in Configure Brand → Culture.',
    verify: (brand, cfg) => !!(cfg?.promise?.trim() && cfg?.key_values?.trim()),
  },
  {
    id: 'non_negotiables',
    label: 'Non-negotiables and restrictions documented',
    hint: 'Fill in Prohibited Topics and Escalation Triggers in Configure Brand → Relationship.',
    verify: (brand, cfg) => !!(cfg?.prohibited_topics?.trim() && cfg?.escalation_triggers?.trim()),
  },
]

function Stage1({ brand, brandConfig }) {
  const cfg = brandConfig?.config ?? {}
  const configLoaded = !!brandConfig

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600 mb-4">
        Each requirement is verified against your brand configuration. Go to{' '}
        <a href={`/dashboard/brands/${brand?.id}/config`} className="underline text-blue-600">Configure Brand</a>{' '}
        to fill in any missing fields.
      </p>
      {ONBOARDING_CHECKS.map(item => {
        const verified = configLoaded ? item.verify(brand, cfg) : false

        return (
          <div
            key={item.id}
            className={[
              'flex items-start gap-3 mt-4 p-4 rounded-lg border',
              verified ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200',
            ].join(' ')}
          >
            <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${verified ? 'bg-green-500' : 'bg-amber-300'}`}>
              {verified
                ? <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                : <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${verified ? 'text-green-800' : 'text-amber-800'}`}>
                {item.label}
              </p>
              {!verified && (
                <p className="text-xs text-amber-700 mt-0.5">{item.hint}</p>
              )}
              {verified && (
                <p className="text-xs text-green-600 mt-0.5">Verified from brand configuration</p>
              )}
            </div>
            {!verified && (
              <a
                href={`/dashboard/brands/${brand?.id}/config`}
                className="text-xs text-blue-600 underline shrink-0 mt-0.5"
              >
                Fix →
              </a>
            )}
          </div>
        )
      })}

      {!configLoaded && (
        <p className="text-xs text-slate-400 text-center pt-2">Loading brand configuration…</p>
      )}
    </div>
  )
}

// ─── Stage 2: Supervised Training ───────────────────────────────────────────

const TEST_SETS = [
  { set: 'A', title: 'Writing & Tone',          count: 6 },
  { set: 'B', title: 'Design & Photography',    count: 6 },
  { set: 'C', title: 'Brand Fit & Consistency', count: 5 },
  { set: 'D', title: 'Checklist Mastery',       count: 3 },
  { set: 'E', title: 'Real Client Scenarios',   count: 5 },
]

function Stage2({ scores, onChange, scenarios, brandId, agentId, onSaveScores }) {
  const [fixing, setFixing] = useState({})
  const [fixSuggestions, setFixSuggestions] = useState({})
  const [saveStates, setSaveStates] = useState({}) // { [key]: 'saving' | 'saved' | error_message }

  // Derive set sizes from actual DB scenarios — fall back to defaults so empty Stage 2 still shows structure
  const scenarioMap = {}
  scenarios.forEach(s => { scenarioMap[`${s.test_set}${s.scenario_number}`] = s })

  const setCounts = {}
  for (const ts of TEST_SETS) {
    const dbCount = scenarios.filter(s => s.test_set === ts.set).length
    setCounts[ts.set] = dbCount > 0 ? dbCount : ts.count
  }
  const totalScenarios = Object.values(setCounts).reduce((a, b) => a + b, 0)

  const passed = Object.entries(setCounts).reduce((acc, [set, count]) => {
    for (let i = 1; i <= count; i++) {
      if (scores[`${set}${i}`] === 'pass') acc++
    }
    return acc
  }, 0)
  const pct = totalScenarios > 0 ? Math.round((passed / totalScenarios) * 100) : 0
  const hasScenarios = scenarios.length > 0

  const handleScenarioFix = async (key) => {
    setFixing(prev => ({ ...prev, [key]: true }))
    setSaveStates(prev => ({ ...prev, [key]: null }))
    try {
      const res = await apiCall(`/api/agents/${agentId}/training/2/fix`, {
        method: 'POST',
        body: JSON.stringify({ scenario: key }),
      })
      if (res.error) {
        setSaveStates(prev => ({ ...prev, [key]: res.error }))
        return
      }
      setFixSuggestions(prev => ({ ...prev, [key]: res }))
    } catch (err) {
      setSaveStates(prev => ({ ...prev, [key]: err?.message || 'AI fix failed' }))
    } finally {
      setFixing(prev => ({ ...prev, [key]: false }))
    }
  }

  const applyScenarioFix = async (key, res) => {
    const score = res.patch?.test_scores?.[key]
    if (!score) return
    const updated = { ...scores, [key]: score }
    onChange(updated)
    setFixSuggestions(prev => ({ ...prev, [key]: null }))
    setSaveStates(prev => ({ ...prev, [key]: 'saving' }))
    try {
      await onSaveScores?.(updated)
      setSaveStates(prev => ({ ...prev, [key]: 'saved' }))
      setTimeout(() => setSaveStates(prev => ({ ...prev, [key]: null })), 3000)
    } catch (err) {
      setSaveStates(prev => ({ ...prev, [key]: err?.message || 'Save failed' }))
    }
  }

  return (
    <div className="space-y-6">
      {/* Workflow guide */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl mt-4 p-4 space-y-2">
        <p className="text-sm font-semibold text-blue-900">How to complete this stage</p>
        <ol className="text-xs text-blue-800 space-y-1 list-decimal list-inside">
          <li>
            Add test prompts for each scenario in{' '}
            <Link href={`/dashboard/brands/${brandId}/scenarios`} className="underline font-medium">
              Brand → Test Scenarios
            </Link>
            .
          </li>
          <li>
            Send each prompt to your agent in the{' '}
            <Link href={`/dashboard/brands/${brandId}/agents/${agentId}`} className="underline font-medium">
              Test Console
            </Link>
            .
          </li>
          <li>Return here and mark each scenario Pass or Fail based on the response.</li>
          <li>Score {totalScenarios}/{totalScenarios} (100%) to advance to Stage 3.</li>
        </ol>
      </div>

      {/* Score bar */}
      <div className="flex items-center justify-between mt-4 p-4 bg-slate-50 rounded-lg">
        <p className="text-sm font-semibold text-slate-700">Score</p>
        <p className={`text-lg font-bold ${pct === 100 && totalScenarios > 0 ? 'text-green-600' : 'text-slate-900'}`}>
          {passed}/{totalScenarios} ({pct}%) {pct === 100 && totalScenarios > 0 ? '✓ Pass' : ''}
        </p>
      </div>

      {!hasScenarios && (
        <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl">
          <p className="text-sm font-semibold text-slate-700 mb-1">No scenario prompts yet</p>
          <p className="text-xs text-slate-500 mb-4">Add prompts so each scenario shows what to test the agent with.</p>
          <Link href={`/dashboard/brands/${brandId}/scenarios`}>
            <Button size="sm">Go to Test Scenarios →</Button>
          </Link>
        </div>
      )}

      {TEST_SETS.map(ts => (
        <div key={ts.set}>
          <h3 className="text-sm font-bold text-slate-800 mb-2">
            Set {ts.set}: {ts.title}
          </h3>
          <div className="space-y-2">
            {Array.from({ length: setCounts[ts.set] }, (_, i) => {
              const key = `${ts.set}${i + 1}`
              const val = scores[key]
              const scenario = scenarioMap[key]
              const suggestion = fixSuggestions[key]
              const suggestedScore = suggestion?.patch?.test_scores?.[key]
              return (
                <div key={key} className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="flex items-start justify-between px-4 py-3 bg-white gap-4">
                    <div className="flex-1 min-w-0 space-y-2">
                      <p className="text-sm font-semibold text-slate-800">Scenario {key}</p>

                      <div>
                        <p className="text-xs font-medium text-slate-500 mb-0.5">Input Prompt</p>
                        {scenario?.input_prompt
                          ? <p className="text-xs text-slate-700">{scenario.input_prompt}</p>
                          : <p className="text-xs text-slate-300 italic">No prompt added yet</p>
                        }
                      </div>

                      {(scenario?.good_example || scenario?.bad_example) && (
                        <div className="grid grid-cols-2 gap-3">
                          {scenario.good_example && (
                            <div className="bg-green-50 border border-green-100 rounded p-2">
                              <p className="text-xs font-medium text-green-700 mb-0.5">Good Example</p>
                              <p className="text-xs text-green-800">{scenario.good_example}</p>
                            </div>
                          )}
                          {scenario.bad_example && (
                            <div className="bg-red-50 border border-red-100 rounded p-2">
                              <p className="text-xs font-medium text-red-700 mb-0.5">Bad Example</p>
                              <p className="text-xs text-red-800">{scenario.bad_example}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {scenario?.evaluation_criteria && (
                        <div>
                          <p className="text-xs font-medium text-slate-500 mb-0.5">Evaluation Criteria</p>
                          {typeof scenario.evaluation_criteria === 'string'
                            ? <p className="text-xs text-slate-600">{scenario.evaluation_criteria}</p>
                            : Array.isArray(scenario.evaluation_criteria)
                              ? <ul className="text-xs text-slate-600 space-y-0.5">
                                  {scenario.evaluation_criteria.map((c, i) => <li key={i}>• {String(c)}</li>)}
                                </ul>
                              : <ul className="text-xs text-slate-600 space-y-0.5">
                                  {Object.entries(scenario.evaluation_criteria).map(([k, v]) => (
                                    <li key={k}><span className="font-medium">{k}:</span> {String(v)}</li>
                                  ))}
                                </ul>
                          }
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleScenarioFix(key)}
                          disabled={fixing[key]}
                          title="Get AI suggestion"
                          className="w-7 h-7 flex items-center justify-center rounded bg-violet-50 border border-violet-200 text-violet-600 hover:bg-violet-100 disabled:opacity-50"
                        >
                          {fixing[key]
                            ? <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                            : <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                          }
                        </button>
                        {['pass', 'fail'].map(v => (
                          <button
                            key={v}
                            onClick={() => onChange({ ...scores, [key]: val === v ? undefined : v })}
                            className={[
                              'px-3 py-1 rounded text-xs font-medium transition-colors',
                              val === v && v === 'pass' ? 'bg-green-600 text-white' :
                              val === v && v === 'fail' ? 'bg-red-600 text-white' :
                              'bg-slate-100 text-slate-600 hover:bg-slate-200',
                            ].join(' ')}
                          >
                            {v === 'pass' ? 'Pass' : 'Fail'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  {suggestion && (
                    <div className="px-4 py-3 bg-violet-50 border-t border-violet-200 space-y-2">
                      <p className="text-xs font-semibold text-violet-800">AI Suggestion</p>
                      <p className="text-xs text-slate-600">{suggestion.summary}</p>
                      {suggestion.changes?.map((c, i) => (
                        <div key={i} className="flex gap-3 items-center">
                          {c.from != null && (
                            <span className="text-xs text-red-600 bg-red-50 border border-red-100 rounded px-2 py-0.5 line-through">{String(c.from)}</span>
                          )}
                          <span className="text-xs text-slate-400">→</span>
                          <span className={`text-xs font-semibold rounded px-2 py-0.5 border ${suggestedScore === 'pass' ? 'text-green-700 bg-green-50 border-green-200' : 'text-red-700 bg-red-50 border-red-200'}`}>
                            {String(c.to)}
                          </span>
                        </div>
                      ))}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => applyScenarioFix(key, suggestion)}
                          disabled={saveStates[key] === 'saving'}
                          className="text-xs font-medium px-3 py-1 rounded bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
                        >
                          {saveStates[key] === 'saving' ? 'Saving…' : 'Apply'}
                        </button>
                        <button
                          onClick={() => setFixSuggestions(prev => ({ ...prev, [key]: null }))}
                          disabled={saveStates[key] === 'saving'}
                          className="text-xs font-medium px-3 py-1 rounded bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  )}
                  {saveStates[key] === 'saved' && (
                    <div className="px-4 py-2 bg-green-50 border-t border-green-200">
                      <p className="text-xs text-green-700 font-medium">✓ Score saved</p>
                    </div>
                  )}
                  {saveStates[key] && saveStates[key] !== 'saving' && saveStates[key] !== 'saved' && (
                    <div className="px-4 py-2 bg-red-50 border-t border-red-200">
                      <p className="text-xs text-red-700">Save failed: {saveStates[key]}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Stage 3: Probation ──────────────────────────────────────────────────────

function WeekReview({ weekKey, label, data, onChange }) {
  const update = (field, value) => onChange({ ...data, [field]: value })
  return (
    <div className={[
      'border rounded-xl p-5 space-y-4',
      data?.passed ? 'bg-green-50 border-green-200' : 'bg-white border-slate-200',
    ].join(' ')}>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">{label}</h3>
        <div className="flex gap-2">
          {['passed', 'failed'].map(v => (
            <button
              key={v}
              onClick={() => update('passed', v === 'passed' ? !data?.passed : false)}
              className={[
                'px-3 py-1 rounded text-xs font-medium transition-colors',
                data?.passed && v === 'passed' ? 'bg-green-600 text-white' :
                data?.passed === false && v === 'failed' ? 'bg-red-600 text-white' :
                'bg-slate-100 text-slate-600 hover:bg-slate-200',
              ].join(' ')}
            >
              {v === 'passed' ? 'Pass' : 'Fail'}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-slate-600 block mb-1">Review Date</label>
        <input
          type="date"
          value={data?.date ?? ''}
          onChange={e => update('date', e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-slate-600 block mb-1">Review Notes</label>
        <Textarea
          placeholder="Describe the output reviewed this week…"
          value={data?.notes ?? ''}
          onChange={e => update('notes', e.target.value)}
          className="min-h-[80px] text-sm"
        />
      </div>
    </div>
  )
}

function Stage3({ results, onChange }) {
  const update = (key, value) => onChange({ ...results, [key]: value })
  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-600">
        Review the agent&apos;s output over two consecutive weeks in a low-stakes environment.
        Both weeks must pass to complete this stage.
      </p>
      <WeekReview weekKey="week1" label="Week 1 Review" data={results.week1} onChange={v => update('week1', v)} />
      <WeekReview weekKey="week2" label="Week 2 Review" data={results.week2} onChange={v => update('week2', v)} />
    </div>
  )
}

// ─── Stage 4: Certification ──────────────────────────────────────────────────

const CERT_TESTS = [
  { id: 'test1', label: 'Write a Brand Caption',       desc: 'Agent writes a social media caption that matches brand voice and BRR guidelines.' },
  { id: 'test2', label: 'Identify Brand Violations',   desc: 'Agent reviews 3 pieces of content and flags what violates the BRR.' },
  { id: 'test3', label: 'Explain Brand Philosophy',    desc: 'Agent explains the brand soul and core promise in its own words.' },
]

function CertTest({ data, label, desc, onChange }) {
  const update = (field, value) => onChange({ ...data, [field]: value })
  return (
    <div className={[
      'border rounded-xl p-5 space-y-4',
      data?.passed ? 'bg-green-50 border-green-200' : 'bg-white border-slate-200',
    ].join(' ')}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-900">{label}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
        </div>
        <div className="flex gap-2 ml-4 shrink-0">
          {['pass', 'fail'].map(v => (
            <button
              key={v}
              onClick={() => update('passed', v === 'pass' ? !data?.passed : false)}
              className={[
                'px-3 py-1 rounded text-xs font-medium transition-colors',
                data?.passed && v === 'pass' ? 'bg-green-600 text-white' :
                data?.passed === false && v === 'fail' ? 'bg-red-600 text-white' :
                'bg-slate-100 text-slate-600 hover:bg-slate-200',
              ].join(' ')}
            >
              {v === 'pass' ? 'Pass' : 'Fail'}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-slate-600 block mb-1">Agent Output</label>
        <Textarea
          placeholder="Paste the agent's response here…"
          value={data?.output ?? ''}
          onChange={e => update('output', e.target.value)}
          className="min-h-[80px] text-sm"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-slate-600 block mb-1">Evaluator Notes</label>
        <Textarea
          placeholder="Why did it pass or fail?"
          value={data?.evaluator_notes ?? ''}
          onChange={e => update('evaluator_notes', e.target.value)}
          className="min-h-[60px] text-sm"
        />
      </div>
    </div>
  )
}

function Stage4({ results, onChange }) {
  const update = (key, value) => onChange({ ...results, [key]: value })
  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-600">
        Three certification tests — all must pass to certify the agent.
      </p>
      {CERT_TESTS.map(t => (
        <CertTest
          key={t.id}
          data={results[t.id] ?? {}}
          label={t.label}
          desc={t.desc}
          onChange={v => update(t.id, v)}
        />
      ))}
    </div>
  )
}

// ─── Stage 5: Deployment ─────────────────────────────────────────────────────

function Stage5({ results, onChange }) {
  const update = (field, value) => onChange({ ...results, [field]: value })

  const addSpotCheck = () => {
    const checks = results.spot_checks ?? []
    onChange({ ...results, spot_checks: [...checks, { date: '', passed: null, notes: '' }] })
  }

  const updateSpotCheck = (idx, field, value) => {
    const checks = [...(results.spot_checks ?? [])]
    checks[idx] = { ...checks[idx], [field]: value }
    onChange({ ...results, spot_checks: checks })
  }

  const removeSpotCheck = (idx) => {
    const checks = (results.spot_checks ?? []).filter((_, i) => i !== idx)
    onChange({ ...results, spot_checks: checks })
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600">
        Agent is live. Record the deployment date, then log weekly spot-checks and monthly reviews.
      </p>

      <div>
        <label className="text-sm font-medium text-slate-700 block mb-2">Deployment Date *</label>
        <input
          type="date"
          value={results.deployed_date ?? ''}
          onChange={e => update('deployed_date', e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-800">Weekly Spot-Checks</h3>
          <Button size="sm" variant="outline" onClick={addSpotCheck}>+ Add Check</Button>
        </div>
        {(results.spot_checks ?? []).length === 0 && (
          <p className="text-sm text-slate-400 py-4 text-center border border-dashed border-slate-200 rounded-lg">
            No spot-checks logged yet
          </p>
        )}
        <div className="space-y-3">
          {(results.spot_checks ?? []).map((check, idx) => (
            <div key={idx} className="border border-slate-200 rounded-lg mt-4 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <input
                  type="date"
                  value={check.date}
                  onChange={e => updateSpotCheck(idx, 'date', e.target.value)}
                  className="border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex items-center gap-2">
                  {['pass', 'fail'].map(v => (
                    <button
                      key={v}
                      onClick={() => updateSpotCheck(idx, 'passed', v === 'pass')}
                      className={[
                        'px-3 py-1 rounded text-xs font-medium transition-colors',
                        check.passed === true  && v === 'pass' ? 'bg-green-600 text-white' :
                        check.passed === false && v === 'fail' ? 'bg-red-600 text-white' :
                        'bg-slate-100 text-slate-600 hover:bg-slate-200',
                      ].join(' ')}
                    >
                      {v === 'pass' ? 'Pass' : 'Fail'}
                    </button>
                  ))}
                  <button onClick={() => removeSpotCheck(idx)} className="text-xs text-red-500 hover:text-red-700 ml-1">
                    Remove
                  </button>
                </div>
              </div>
              <Textarea
                placeholder="What was checked? Any issues found?"
                value={check.notes}
                onChange={e => updateSpotCheck(idx, 'notes', e.target.value)}
                className="min-h-[60px] text-sm"
              />
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700 block mb-2">Monthly Review Notes</label>
        <Textarea
          placeholder="Summary of the agent's performance this month…"
          value={results.monthly_review ?? ''}
          onChange={e => update('monthly_review', e.target.value)}
          className="min-h-[100px] text-sm"
        />
      </div>
    </div>
  )
}

// ─── Stage 6: Ongoing Learning ────────────────────────────────────────────────

function Stage6({ results, onChange }) {
  const update = (field, value) => onChange({ ...results, [field]: value })

  const addUpdate = () => {
    const updates = results.brr_updates ?? []
    onChange({ ...results, brr_updates: [...updates, { date: '', version: '', description: '' }] })
  }

  const updateBRR = (idx, field, value) => {
    const updates = [...(results.brr_updates ?? [])]
    updates[idx] = { ...updates[idx], [field]: value }
    onChange({ ...results, brr_updates: updates })
  }

  const removeBRR = (idx) => {
    const updates = (results.brr_updates ?? []).filter((_, i) => i !== idx)
    onChange({ ...results, brr_updates: updates })
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600">
        Track BRR updates, re-training cycles, and version history to keep the agent current.
      </p>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-800">BRR Updates</h3>
          <Button size="sm" variant="outline" onClick={addUpdate}>+ Add Update</Button>
        </div>
        {(results.brr_updates ?? []).length === 0 && (
          <p className="text-sm text-slate-400 py-4 text-center border border-dashed border-slate-200 rounded-lg">
            No BRR updates logged yet
          </p>
        )}
        <div className="space-y-3">
          {(results.brr_updates ?? []).map((u, idx) => (
            <div key={idx} className="border border-slate-200 rounded-lg mt-4 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="text-xs text-slate-500 block mb-1">Date</label>
                  <input
                    type="date"
                    value={u.date}
                    onChange={e => updateBRR(idx, 'date', e.target.value)}
                    className="border border-slate-200 rounded px-2 py-1 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="w-24">
                  <label className="text-xs text-slate-500 block mb-1">Version</label>
                  <input
                    type="text"
                    placeholder="e.g. 1.1"
                    value={u.version}
                    onChange={e => updateBRR(idx, 'version', e.target.value)}
                    className="border border-slate-200 rounded px-2 py-1 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button onClick={() => removeBRR(idx)} className="text-xs text-red-500 hover:text-red-700 mt-5">
                  Remove
                </button>
              </div>
              <Textarea
                placeholder="What changed in this BRR update?"
                value={u.description}
                onChange={e => updateBRR(idx, 'description', e.target.value)}
                className="min-h-[60px] text-sm"
              />
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700 block mb-2">Re-training Notes</label>
        <Textarea
          placeholder="Notes on re-training cycles triggered by BRR updates…"
          value={results.retraining_notes ?? ''}
          onChange={e => update('retraining_notes', e.target.value)}
          className="min-h-[100px] text-sm"
        />
      </div>
    </div>
  )
}

// ─── AI Analyse & Fix ─────────────────────────────────────────────────────────

function ScoreBadge({ score }) {
  if (score == null) return null
  const color = score >= 10 ? 'bg-green-100 text-green-800 border-green-200'
    : score >= 7 ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
    : 'bg-red-100 text-red-800 border-red-200'
  return <span className={`text-sm font-bold px-2.5 py-0.5 rounded-full border ${color}`}>{score}/10</span>
}

const FIX_STEPS = [
  { key: 'evaluate', label: 'Evaluating current stage with AI' },
  { key: 'generate', label: 'Generating targeted fixes' },
]

function AiFixLoading({ step }) {
  const stepIndex = FIX_STEPS.findIndex(s => s.key === step)

  return (
    <div className="mt-4 border border-violet-200 rounded-xl bg-violet-50 px-5 py-5">
      <div className="flex items-center gap-2 mb-4">
        <svg className="w-4 h-4 text-violet-500 animate-pulse" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 14.93V17a1 1 0 0 1-2 0v-.07A8 8 0 0 1 4.07 11H4a1 1 0 0 1 0-2h.07A8 8 0 0 1 11 4.07V4a1 1 0 0 1 2 0v.07A8 8 0 0 1 19.93 11H20a1 1 0 0 1 0 2h-.07A8 8 0 0 1 13 16.93z"/></svg>
        <p className="text-sm font-semibold text-violet-900">AI Fix in progress…</p>
      </div>
      <div className="space-y-3">
        {FIX_STEPS.map((s, i) => {
          const done    = i < stepIndex
          const current = i === stepIndex
          const pending = i > stepIndex
          return (
            <div key={s.key} className="flex items-center gap-3">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                done    ? 'bg-green-500' :
                current ? 'bg-violet-500' :
                          'bg-slate-200'
              }`}>
                {done && (
                  <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                )}
                {current && (
                  <svg className="w-3 h-3 text-white animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                )}
                {pending && (
                  <div className="w-2 h-2 rounded-full bg-slate-400" />
                )}
              </div>
              <p className={`text-sm ${
                done    ? 'text-green-700 line-through' :
                current ? 'text-violet-800 font-medium' :
                          'text-slate-400'
              }`}>
                {s.label}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── AI Fix Panel ─────────────────────────────────────────────────────────────

function AiFixPanel({ fixResult, applying, applyError, onApply, onDismiss }) {
  if (!fixResult) return null

  const { summary, changes, evalResult } = fixResult
  const hasChanges = changes?.length > 0

  return (
    <div className="mt-4 border border-violet-200 rounded-xl bg-violet-50 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-violet-200 bg-violet-100">
        <div className="flex items-center gap-2">
          {evalResult && <ScoreBadge score={evalResult.score} />}
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${evalResult?.ready ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
            {evalResult?.ready ? 'AI: Ready to advance' : 'AI: Needs improvement'}
          </span>
        </div>
        <button onClick={onDismiss} className="text-violet-400 hover:text-violet-700">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      {evalResult?.recommendations?.length > 0 && (
        <div className="px-5 pt-4">
          <ul className="space-y-1.5">
            {evalResult.recommendations.map((r, i) => (
              <li key={i} className="flex gap-2 text-sm text-slate-700">
                <span className="text-slate-400 shrink-0">–</span>{r}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="px-5 py-4 space-y-3">
        <p className="text-xs text-violet-700 font-medium">{summary}</p>

        {hasChanges ? (
          <div className="space-y-2">
            {changes.map((change, i) => (
              <div key={i} className="bg-white border border-violet-100 rounded-lg p-3">
                <p className="text-xs font-semibold text-slate-700 mb-1.5">{change.label}</p>
                <div className="space-y-1">
                  {change.from != null && (
                    <div className="flex gap-2 items-start">
                      <span className="text-xs text-red-500 font-mono shrink-0 mt-0.5">−</span>
                      <p className="text-xs text-red-700 bg-red-50 rounded px-2 py-1 w-full">{String(change.from)}</p>
                    </div>
                  )}
                  <div className="flex gap-2 items-start">
                    <span className="text-xs text-green-600 font-mono shrink-0 mt-0.5">+</span>
                    <p className="text-xs text-green-800 bg-green-50 rounded px-2 py-1 w-full whitespace-pre-wrap">{String(change.to)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500 text-center py-4 border border-dashed border-violet-200 rounded-lg">
            No specific changes needed — your configuration looks complete.
          </p>
        )}
      </div>

      <div className="px-5 py-3 border-t border-violet-200 bg-violet-50 space-y-2">
        {applyError && (
          <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{applyError}</p>
        )}
        <div className="flex gap-2">
          {hasChanges && (
            <Button
              size="sm"
              onClick={onApply}
              disabled={applying}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              {applying ? 'Applying…' : 'Apply Changes'}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={onDismiss} disabled={applying}>
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Completion rules ────────────────────────────────────────────────────────

function canComplete(num, results, scores, scenarios = []) {
  if (num === 1) return ONBOARDING_CHECKS.every(c => results[c.id])
  if (num === 2) {
    // Require every actual scenario in the DB to be marked "pass"
    if (scenarios.length === 0) return false
    return scenarios.every(s => scores[`${s.test_set}${s.scenario_number}`] === 'pass')
  }
  if (num === 3) return !!(results.week1?.passed && results.week2?.passed)
  if (num === 4) return !!(results.test1?.passed && results.test2?.passed && results.test3?.passed)
  if (num === 5) return !!results.deployed_date
  return true
}

const STAGE_NAMES = ['Onboarding', 'Supervised Training', 'Probation', 'Certification', 'Deployment', 'Ongoing Learning']

// ─── Main page ────────────────────────────────────────────────────────────────

export default function StagePage() {
  const { brandId, agentId, stageNum } = useParams()
  const num = parseInt(stageNum)
  const { stages, isLoading, isSaving, saveStage, getStage } = useTraining(agentId)

  const [results, setResults] = useState({})
  const [scores, setScores] = useState({})
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [scenarios, setScenarios] = useState([])
  const [brand, setBrand] = useState(null)
  const [brandConfig, setBrandConfig] = useState(null)
  const [isFixing, setIsFixing] = useState(false)
  const [fixStep, setFixStep] = useState(null)
  const [fixResult, setFixResult] = useState(null)
  const [isApplying, setIsApplying] = useState(false)
  const [fixError, setFixError] = useState('')
  const [applyError, setApplyError] = useState('')

  const stage = getStage(num)

  useEffect(() => {
    if (stage) {
      setResults(stage.validation_results ?? {})
      setScores(stage.test_scores ?? {})
    }
  }, [stage])

  const handleSaveScenarioScores = useCallback(async (newScores) => {
    await saveStage(num, {
      status: stage?.status === 'Complete' ? 'Complete' : 'In Progress',
      validation_results: results,
      test_scores: newScores,
    })
  }, [saveStage, num, stage?.status, results])

  useEffect(() => {
    if (num === 2 && brandId) {
      apiCall(`/api/brands/${brandId}/scenarios`).then(setScenarios).catch(() => {})
    }
    if (num === 1 && brandId) {
      Promise.all([
        apiCall(`/api/brands/${brandId}`),
        apiCall(`/api/brands/${brandId}/config`),
      ]).then(([b, cfg]) => { setBrand(b); setBrandConfig(cfg) }).catch(() => {})
    }
  }, [num, brandId])

  // Re-verify all Stage 1 checks atomically whenever brand data or config changes
  useEffect(() => {
    if (num !== 1 || !brand || !brandConfig) return
    const cfg = brandConfig?.config ?? {}
    const verified = {}
    ONBOARDING_CHECKS.forEach(item => { verified[item.id] = item.verify(brand, cfg) })
    setResults(verified)
  }, [brand, brandConfig, num])

  const handleSave = async (complete = false) => {
    setSaveError('')
    setSaved(false)
    try {
      await saveStage(num, {
        status: complete ? 'Complete' : (stage?.status === 'Complete' ? 'Complete' : 'In Progress'),
        validation_results: results,
        test_scores: scores,
      })
      if (!complete) {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    } catch (err) {
      setSaveError(err.message)
    }
  }

  const handleAnalyseAndFix = async () => {
    setIsFixing(true)
    setFixStep('evaluate')
    setFixError('')
    setFixResult(null)

    try {
      const evalRes = await apiCall(`/api/agents/${agentId}/training/${num}/evaluate`, { method: 'POST' })

      setFixStep('generate')
      const recommendations = evalRes?.recommendations ?? []
      const res = await apiCall(`/api/agents/${agentId}/training/${num}/fix`, {
        method: 'POST',
        body: JSON.stringify({ recommendations }),
      })

      if (res.error) { setFixError(res.error); return }
      setFixResult({ ...res, evalResult: evalRes })
    } catch (err) {
      setFixError(err.message)
    } finally {
      setIsFixing(false)
      setFixStep(null)
    }
  }

  const handleApply = async () => {
    if (!fixResult?.patch) {
      setApplyError('No changes to apply — try running AI Fix again.')
      return
    }
    setIsApplying(true)
    setApplyError('')
    try {
      const { patch, brandId: fixBrandId } = fixResult

      if (patch.type === 'brand_config') {
        const currentCfg = brandConfig?.config ?? {}
        const merged = { ...currentCfg, ...patch.config }
        await apiCall(`/api/brands/${fixBrandId}/config`, {
          method: 'PUT',
          body: JSON.stringify({ config: merged }),
        })
        const updated = await apiCall(`/api/brands/${fixBrandId}/config`)
        setBrandConfig(updated)
      } else {
        const newResults = patch.validation_results
          ? { ...results, ...patch.validation_results }
          : results
        const newScores = patch.test_scores
          ? { ...scores, ...patch.test_scores }
          : scores
        await saveStage(num, {
          status: stage?.status === 'Complete' ? 'Complete' : 'In Progress',
          validation_results: newResults,
          test_scores: newScores,
        })
        setResults(newResults)
        setScores(newScores)
      }

      setFixResult(null)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setApplyError(err.message || 'Failed to apply changes — please try again.')
    } finally {
      setIsApplying(false)
    }
  }

  const isComplete = stage?.status === 'Complete'
  const nextStage = stages.find(s => s.stage === num + 1)

  if (isLoading) {
    return <Card className="p-12 text-center"><p className="text-slate-600">Loading…</p></Card>
  }

  if (!stage) {
    return (
      <Card className="p-12 text-center bg-red-50 border-red-200">
        <p className="text-red-800 mb-4">Stage not found</p>
        <Link href={`/dashboard/brands/${brandId}/agents/${agentId}`}>
          <Button variant="outline">Back to Training</Button>
        </Link>
      </Card>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <Link href={`/dashboard/brands/${brandId}/agents/${agentId}`} className="text-slate-600 hover:text-slate-900 mb-4 inline-block">
          ← Back to Training Overview
        </Link>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-3xl font-bold text-slate-900">
            Stage {num}: {STAGE_NAMES[num - 1]}
          </h1>
          {isComplete && (
            <span className="text-sm px-3 py-1 rounded-full bg-green-100 text-green-700 font-medium">
              Complete ✓
            </span>
          )}
        </div>
      </div>

      {saved && (
        <Alert className="mb-6 bg-green-50 border-green-200">
          <AlertDescription className="text-green-800">Progress saved.</AlertDescription>
        </Alert>
      )}
      {saveError && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{saveError}</AlertDescription>
        </Alert>
      )}

      <Card className="p-8 mb-6">
        {num === 1 && <Stage1 brand={brand} brandConfig={brandConfig} />}
        {num === 2 && <Stage2 scores={scores} onChange={setScores} scenarios={scenarios} brandId={brandId} agentId={agentId} onSaveScores={handleSaveScenarioScores} />}
        {num === 3 && <Stage3 results={results} onChange={setResults} />}
        {num === 4 && <Stage4 results={results} onChange={setResults} />}
        {num === 5 && <Stage5 results={results} onChange={setResults} />}
        {num === 6 && <Stage6 results={results} onChange={setResults} />}

        <div className="flex gap-3 mt-8 flex-wrap">
          <Button variant="outline" onClick={() => handleSave(false)} disabled={isSaving || isFixing}>
            {isSaving ? 'Saving…' : 'Save Progress'}
          </Button>
          {!isComplete && (
            <Button
              variant="outline"
              onClick={handleAnalyseAndFix}
              disabled={isFixing || isSaving}
              className="text-violet-700 border-violet-200 hover:bg-violet-50"
            >
              {isFixing ? 'Analysing…' : 'Analyse & Fix'}
            </Button>
          )}

          {!isComplete && (
            <Button
              onClick={() => handleSave(true)}
              disabled={isSaving || !canComplete(num, results, scores, scenarios)}
              className="flex-1"
            >
              {isSaving ? 'Saving…' : `Complete Stage ${num}`}
            </Button>
          )}

          {isComplete && nextStage && nextStage.status !== 'Pending' && (
            <Link href={`/dashboard/brands/${brandId}/agents/${agentId}/stage/${num + 1}`} className="flex-1">
              <Button className="w-full">Continue to Stage {num + 1} →</Button>
            </Link>
          )}

          {isComplete && num === 6 && (
            <Link href={`/dashboard/brands/${brandId}/agents/${agentId}`} className="flex-1">
              <Button className="w-full bg-green-600 hover:bg-green-700">View Certification 🎉</Button>
            </Link>
          )}
        </div>
      </Card>

      {fixError && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{fixError}</AlertDescription>
        </Alert>
      )}

      {isFixing && fixStep && <AiFixLoading step={fixStep} />}

      {!isFixing && (
        <AiFixPanel
          fixResult={fixResult}
          applying={isApplying}
          applyError={applyError}
          onApply={handleApply}
          onDismiss={() => { setFixResult(null); setFixError(''); setApplyError('') }}
        />
      )}

      {/* Stage-specific hints */}
      {num === 1 && !isComplete && (
        <Card className="mt-4 p-4 bg-blue-50 border-blue-200">
          <p className="text-xs text-blue-800">All 5 checkpoints must be green to complete this stage. The AI score is advisory — it does not block completion.</p>
        </Card>
      )}
      {num === 2 && !isComplete && (
        <Card className="mt-4 p-4 bg-blue-50 border-blue-200">
          <p className="text-xs text-blue-800">
            Every scenario in your test bank must be marked Pass to complete this stage.
            {scenarios.length === 0 && ' Add scenario prompts from Brand → Scenarios to see them here.'}
          </p>
        </Card>
      )}
      {num === 3 && !isComplete && (
        <Card className="mt-4 p-4 bg-blue-50 border-blue-200">
          <p className="text-xs text-blue-800">Both Week 1 and Week 2 reviews must be marked Pass.</p>
        </Card>
      )}
      {num === 4 && !isComplete && (
        <Card className="mt-4 p-4 bg-blue-50 border-blue-200">
          <p className="text-xs text-blue-800">All 3 certification tests must pass.</p>
        </Card>
      )}
      {num === 5 && !isComplete && (
        <Card className="mt-4 p-4 bg-blue-50 border-blue-200">
          <p className="text-xs text-blue-800">Enter the deployment date to enable completion.</p>
        </Card>
      )}
    </div>
  )
}
