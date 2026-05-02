'use client'

import { useEffect, useState } from 'react'
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
  { id: 'brand_name',      label: 'Brand name and identity confirmed' },
  { id: 'brr_complete',    label: 'Brand Road Rules (BRR) configuration completed' },
  { id: 'tone_defined',    label: 'Tone of voice and personality defined' },
  { id: 'promise_set',     label: 'Core promise and brand soul established' },
  { id: 'non_negotiables', label: 'Non-negotiables and restrictions documented' },
]

function Stage1({ results, onChange }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600 mb-4">
        Verify all 5 onboarding requirements are complete before moving to supervised training.
      </p>
      {ONBOARDING_CHECKS.map(item => (
        <label
          key={item.id}
          className={[
            'flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors',
            results[item.id] ? 'bg-green-50 border-green-200' : 'bg-white border-slate-200 hover:bg-slate-50',
          ].join(' ')}
        >
          <input
            type="checkbox"
            checked={!!results[item.id]}
            onChange={e => onChange({ ...results, [item.id]: e.target.checked })}
            className="w-4 h-4 accent-green-600"
          />
          <span className={`text-sm ${results[item.id] ? 'text-green-800 font-medium' : 'text-slate-700'}`}>
            {item.label}
          </span>
        </label>
      ))}
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

function Stage2({ scores, onChange, scenarios }) {
  const passed = TEST_SETS.reduce((acc, ts) => {
    for (let i = 1; i <= ts.count; i++) {
      if (scores[`${ts.set}${i}`] === 'pass') acc++
    }
    return acc
  }, 0)
  const pct = Math.round((passed / 25) * 100)

  const scenarioMap = {}
  scenarios.forEach(s => { scenarioMap[`${s.test_set}${s.scenario_number}`] = s })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
        <p className="text-sm font-semibold text-slate-700">Score</p>
        <p className={`text-lg font-bold ${pct >= 80 ? 'text-green-600' : 'text-slate-900'}`}>
          {passed}/25 ({pct}%) {pct >= 80 ? '✓ Pass' : ''}
        </p>
      </div>
      <p className="text-xs text-slate-500">Need 80% (20/25) to pass this stage.</p>

      {TEST_SETS.map(ts => (
        <div key={ts.set}>
          <h3 className="text-sm font-bold text-slate-800 mb-2">
            Set {ts.set}: {ts.title}
          </h3>
          <div className="space-y-2">
            {Array.from({ length: ts.count }, (_, i) => {
              const key = `${ts.set}${i + 1}`
              const val = scores[key]
              const scenario = scenarioMap[key]
              return (
                <div key={key} className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 bg-white">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700">
                        Scenario {key}
                      </p>
                      {scenario?.input_prompt && (
                        <p className="text-xs text-slate-500 mt-0.5 truncate">{scenario.input_prompt}</p>
                      )}
                    </div>
                    <div className="flex gap-2 ml-4 shrink-0">
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
                  {scenario?.evaluation_criteria && (
                    <div className="px-4 py-2 bg-slate-50 border-t border-slate-100">
                      <p className="text-xs text-slate-500">
                        Criteria: {typeof scenario.evaluation_criteria === 'string'
                          ? scenario.evaluation_criteria
                          : JSON.stringify(scenario.evaluation_criteria)}
                      </p>
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
            <div key={idx} className="border border-slate-200 rounded-lg p-4 space-y-3">
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
            <div key={idx} className="border border-slate-200 rounded-lg p-4 space-y-3">
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

// ─── Completion rules ────────────────────────────────────────────────────────

function canComplete(num, results, scores) {
  if (num === 1) return ONBOARDING_CHECKS.every(c => results[c.id])
  if (num === 2) return Object.values(scores ?? {}).filter(v => v === 'pass').length >= 20
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

  const stage = getStage(num)

  useEffect(() => {
    if (stage) {
      setResults(stage.validation_results ?? {})
      setScores(stage.test_scores ?? {})
    }
  }, [stage])

  useEffect(() => {
    if (num === 2 && brandId) {
      apiCall(`/api/brands/${brandId}/scenarios`).then(setScenarios).catch(() => {})
    }
  }, [num, brandId])

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
        {num === 1 && <Stage1 results={results} onChange={setResults} />}
        {num === 2 && <Stage2 scores={scores} onChange={setScores} scenarios={scenarios} />}
        {num === 3 && <Stage3 results={results} onChange={setResults} />}
        {num === 4 && <Stage4 results={results} onChange={setResults} />}
        {num === 5 && <Stage5 results={results} onChange={setResults} />}
        {num === 6 && <Stage6 results={results} onChange={setResults} />}

        <div className="flex gap-3 mt-8 flex-wrap">
          <Button variant="outline" onClick={() => handleSave(false)} disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Save Progress'}
          </Button>

          {!isComplete && (
            <Button
              onClick={() => handleSave(true)}
              disabled={isSaving || !canComplete(num, results, scores)}
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

      {/* Stage-specific hints */}
      {num === 1 && !isComplete && (
        <Card className="p-4 bg-blue-50 border-blue-200">
          <p className="text-xs text-blue-800">All 5 checkpoints must be ticked to complete this stage.</p>
        </Card>
      )}
      {num === 2 && !isComplete && (
        <Card className="p-4 bg-blue-50 border-blue-200">
          <p className="text-xs text-blue-800">
            Need 20/25 (80%) to pass.
            {scenarios.length === 0 && ' Add scenario prompts from Brand → Scenarios to see them here.'}
          </p>
        </Card>
      )}
      {num === 3 && !isComplete && (
        <Card className="p-4 bg-blue-50 border-blue-200">
          <p className="text-xs text-blue-800">Both Week 1 and Week 2 reviews must be marked Pass.</p>
        </Card>
      )}
      {num === 4 && !isComplete && (
        <Card className="p-4 bg-blue-50 border-blue-200">
          <p className="text-xs text-blue-800">All 3 certification tests must pass.</p>
        </Card>
      )}
      {num === 5 && !isComplete && (
        <Card className="p-4 bg-blue-50 border-blue-200">
          <p className="text-xs text-blue-800">Enter the deployment date to enable completion.</p>
        </Card>
      )}
    </div>
  )
}
