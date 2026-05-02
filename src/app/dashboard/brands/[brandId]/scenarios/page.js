'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { apiCall } from '@/lib/api-client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import Link from 'next/link'

const TEST_SETS = [
  { set: 'A', title: 'Writing & Tone',          count: 6 },
  { set: 'B', title: 'Design & Photography',    count: 6 },
  { set: 'C', title: 'Brand Fit & Consistency', count: 5 },
  { set: 'D', title: 'Checklist Mastery',       count: 3 },
  { set: 'E', title: 'Real Client Scenarios',   count: 5 },
]

function ScenarioForm({ set, num, existing, onSave, onCancel }) {
  const [form, setForm] = useState({
    input_prompt: existing?.input_prompt ?? '',
    good_example: existing?.good_example ?? '',
    bad_example: existing?.bad_example ?? '',
    evaluation_criteria: existing?.evaluation_criteria ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    if (!form.input_prompt.trim()) { setError('Prompt is required'); return }
    setSaving(true)
    setError('')
    try {
      await onSave({ ...form, test_set: set, scenario_number: num })
      onCancel()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border border-blue-200 rounded-xl p-5 bg-blue-50 space-y-4">
      <p className="text-sm font-semibold text-blue-900">Scenario {set}{num}</p>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div>
        <Label className="text-xs">Input Prompt *</Label>
        <Textarea
          placeholder="What task or scenario is given to the agent?"
          value={form.input_prompt}
          onChange={e => setForm(f => ({ ...f, input_prompt: e.target.value }))}
          className="mt-1 text-sm min-h-[80px]"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Good Example</Label>
          <Textarea
            placeholder="Ideal agent response…"
            value={form.good_example}
            onChange={e => setForm(f => ({ ...f, good_example: e.target.value }))}
            className="mt-1 text-sm min-h-[70px]"
          />
        </div>
        <div>
          <Label className="text-xs">Bad Example</Label>
          <Textarea
            placeholder="What a failing response looks like…"
            value={form.bad_example}
            onChange={e => setForm(f => ({ ...f, bad_example: e.target.value }))}
            className="mt-1 text-sm min-h-[70px]"
          />
        </div>
      </div>
      <div>
        <Label className="text-xs">Evaluation Criteria</Label>
        <Input
          placeholder="e.g. Matches tone, includes CTA, avoids jargon"
          value={form.evaluation_criteria}
          onChange={e => setForm(f => ({ ...f, evaluation_criteria: e.target.value }))}
          className="mt-1 text-sm"
        />
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  )
}

export default function ScenariosPage() {
  const { brandId } = useParams()
  const [scenarios, setScenarios] = useState([])
  const [brand, setBrand] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeSet, setActiveSet] = useState('A')
  const [editing, setEditing] = useState(null) // "A3" format
  const [deleting, setDeleting] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      apiCall(`/api/brands/${brandId}/scenarios`),
      apiCall(`/api/brands/${brandId}`),
    ]).then(([s, b]) => { setScenarios(s); setBrand(b) })
      .catch(err => setError(err.message))
      .finally(() => setIsLoading(false))
  }, [brandId])

  const scenarioMap = {}
  scenarios.forEach(s => { scenarioMap[`${s.test_set}${s.scenario_number}`] = s })

  const handleSave = async (data) => {
    const result = await apiCall(`/api/brands/${brandId}/scenarios`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
    setScenarios(prev => {
      const key = `${result.test_set}${result.scenario_number}`
      const filtered = prev.filter(s => `${s.test_set}${s.scenario_number}` !== key)
      return [...filtered, result].sort((a, b) => a.test_set.localeCompare(b.test_set) || a.scenario_number - b.scenario_number)
    })
  }

  const handleDelete = async (scenario) => {
    const key = `${scenario.test_set}${scenario.scenario_number}`
    setDeleting(key)
    try {
      await apiCall(`/api/brands/${brandId}/scenarios/${scenario.id}`, { method: 'DELETE' })
      setScenarios(prev => prev.filter(s => s.id !== scenario.id))
    } catch (err) {
      setError(err.message)
    } finally {
      setDeleting(null)
    }
  }

  const currentSet = TEST_SETS.find(ts => ts.set === activeSet)
  const filled = scenarios.filter(s => s.test_set === activeSet).length

  if (isLoading) {
    return <Card className="p-12 text-center"><p className="text-slate-600">Loading…</p></Card>
  }

  return (
    <div>
      <div className="mb-8">
        <Link href={`/dashboard/brands/${brandId}`} className="text-slate-600 hover:text-slate-900 mb-4 inline-block">
          ← Back to Brand
        </Link>
        <h1 className="text-3xl font-bold text-slate-900">Test Scenarios</h1>
        {brand && <p className="text-slate-600 mt-1">{brand.name} — Stage 2 training content</p>}
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Progress overview */}
      <div className="grid grid-cols-5 gap-3 mb-8">
        {TEST_SETS.map(ts => {
          const count = scenarios.filter(s => s.test_set === ts.set).length
          return (
            <Card key={ts.set} className={`p-4 text-center cursor-pointer transition-all ${activeSet === ts.set ? 'ring-2 ring-blue-500' : 'hover:bg-slate-50'}`}
              onClick={() => setActiveSet(ts.set)}>
              <p className="text-xs font-semibold text-slate-500">Set {ts.set}</p>
              <p className="text-lg font-bold text-slate-900 mt-1">{count}/{ts.count}</p>
              <p className="text-xs text-slate-400 mt-0.5 truncate">{ts.title}</p>
            </Card>
          )
        })}
      </div>

      {/* Active set */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-slate-900">
          Set {activeSet}: {currentSet.title}
          <span className="text-sm font-normal text-slate-500 ml-2">({filled}/{currentSet.count} filled)</span>
        </h2>
      </div>

      <div className="space-y-3">
        {Array.from({ length: currentSet.count }, (_, i) => {
          const num = i + 1
          const key = `${activeSet}${num}`
          const existing = scenarioMap[key]
          const isEditing = editing === key
          const isDeleting = deleting === key

          if (isEditing) {
            return (
              <ScenarioForm
                key={key}
                set={activeSet}
                num={num}
                existing={existing}
                onSave={handleSave}
                onCancel={() => setEditing(null)}
              />
            )
          }

          return (
            <div key={key} className={`border rounded-xl p-4 ${existing ? 'bg-white border-slate-200' : 'bg-slate-50 border-dashed border-slate-300'}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-700">Scenario {key}</p>
                  {existing ? (
                    <p className="text-sm text-slate-600 mt-1 line-clamp-2">{existing.input_prompt}</p>
                  ) : (
                    <p className="text-xs text-slate-400 mt-1">No content yet</p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => setEditing(key)}>
                    {existing ? 'Edit' : 'Add'}
                  </Button>
                  {existing && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 hover:text-red-700"
                      disabled={isDeleting}
                      onClick={() => handleDelete(existing)}
                    >
                      {isDeleting ? '…' : 'Delete'}
                    </Button>
                  )}
                </div>
              </div>
              {existing?.evaluation_criteria && (
                <p className="text-xs text-slate-400 mt-2">
                  Criteria: {typeof existing.evaluation_criteria === 'string'
                    ? existing.evaluation_criteria
                    : JSON.stringify(existing.evaluation_criteria)}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
