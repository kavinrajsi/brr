'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { apiCall } from '@/lib/api-client'
import { ChatConsole } from '@/components/training/ChatConsole'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const TEST_SETS = [
  { set: 'A', title: 'Writing & Tone' },
  { set: 'B', title: 'Design & Photography' },
  { set: 'C', title: 'Brand Fit & Consistency' },
  { set: 'D', title: 'Checklist Mastery' },
  { set: 'E', title: 'Real Client Scenarios' },
]

export default function AgentTestPage() {
  const { brandId, agentId } = useParams()
  const searchParams = useSearchParams()
  const initialKey = searchParams.get('scenario') || null

  const [agent, setAgent] = useState(null)
  const [scenarios, setScenarios] = useState([])
  const [selectedKey, setSelectedKey] = useState(initialKey)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      apiCall(`/api/agents/${agentId}`).catch(() => null),
      apiCall(`/api/brands/${brandId}/scenarios`).catch(() => []),
    ]).then(([a, s]) => {
      setAgent(a)
      setScenarios(Array.isArray(s) ? s : [])
      setLoading(false)
    })
  }, [agentId, brandId])

  if (loading) {
    return <Card className="p-12 text-center"><p className="text-slate-600">Loading…</p></Card>
  }

  if (!agent) {
    return (
      <Card className="p-12 text-center bg-red-50 border-red-200">
        <p className="text-red-800 mb-4">Agent not found</p>
        <Link href={`/dashboard/brands/${brandId}/agents/${agentId}`}>
          <Button variant="outline">Back</Button>
        </Link>
      </Card>
    )
  }

  const scenarioMap = {}
  scenarios.forEach(s => { scenarioMap[`${s.test_set}${s.scenario_number}`] = s })
  const selectedScenario = selectedKey ? scenarioMap[selectedKey] : null
  const initialPrompt = selectedScenario?.input_prompt ?? ''

  return (
    <div>
      <div className="mb-6">
        <Link href={`/dashboard/brands/${brandId}/agents/${agentId}`} className="text-slate-600 hover:text-slate-900 mb-3 inline-block text-sm">
          ← Back to Training Overview
        </Link>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Test Console</h1>
            <p className="text-sm text-slate-600 mt-0.5">{agent.name} — Stage {agent.current_stage} ({agent.status})</p>
          </div>
          <Link href={`/dashboard/brands/${brandId}/agents/${agentId}/stage/2`}>
            <Button variant="outline" size="sm">← Score Scenarios in Stage 2</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Scenario picker */}
        <div className="lg:col-span-1">
          <Card className="p-4">
            <h2 className="text-sm font-bold text-slate-800 mb-3">Test Scenarios</h2>
            {scenarios.length === 0 ? (
              <div className="text-xs text-slate-500 p-3 border border-dashed border-slate-200 rounded">
                No scenarios yet.{' '}
                <Link href={`/dashboard/brands/${brandId}/scenarios`} className="text-blue-600 underline">
                  Add some →
                </Link>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                {TEST_SETS.map(ts => {
                  const setScenarios = scenarios.filter(s => s.test_set === ts.set)
                  if (setScenarios.length === 0) return null
                  return (
                    <div key={ts.set}>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                        Set {ts.set}: {ts.title}
                      </p>
                      <div className="space-y-1">
                        {setScenarios.map(s => {
                          const key = `${s.test_set}${s.scenario_number}`
                          const isSelected = key === selectedKey
                          return (
                            <button
                              key={key}
                              onClick={() => setSelectedKey(key)}
                              className={[
                                'w-full text-left px-2 py-1.5 rounded text-xs border transition-colors',
                                isSelected
                                  ? 'bg-blue-50 border-blue-300 text-blue-900'
                                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50',
                              ].join(' ')}
                            >
                              <p className="font-medium">{key}</p>
                              {s.input_prompt && (
                                <p className="text-slate-500 truncate mt-0.5">{s.input_prompt}</p>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>

        </div>

        {/* Selected scenario details + Chat console */}
        <div className="lg:col-span-2 space-y-4">
          {selectedScenario && (
            <Card className="p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Selected: {selectedKey}</p>

              {selectedScenario.input_prompt && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-slate-500 mb-0.5">Input Prompt</p>
                  <p className="text-xs text-slate-700">{selectedScenario.input_prompt}</p>
                </div>
              )}

              {(selectedScenario.good_example || selectedScenario.bad_example) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  {selectedScenario.good_example && (
                    <div className="bg-green-50 border border-green-100 rounded p-2">
                      <p className="text-xs font-medium text-green-700 mb-0.5">Good Example</p>
                      <p className="text-xs text-green-800">{selectedScenario.good_example}</p>
                    </div>
                  )}
                  {selectedScenario.bad_example && (
                    <div className="bg-red-50 border border-red-100 rounded p-2">
                      <p className="text-xs font-medium text-red-700 mb-0.5">Bad Example</p>
                      <p className="text-xs text-red-800">{selectedScenario.bad_example}</p>
                    </div>
                  )}
                </div>
              )}

              {selectedScenario.evaluation_criteria && (
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-0.5">Evaluation Criteria</p>
                  {typeof selectedScenario.evaluation_criteria === 'string'
                    ? <p className="text-xs text-slate-600">{selectedScenario.evaluation_criteria}</p>
                    : Array.isArray(selectedScenario.evaluation_criteria)
                      ? <ul className="text-xs text-slate-600 space-y-0.5">
                          {selectedScenario.evaluation_criteria.map((c, i) => <li key={i}>• {String(c)}</li>)}
                        </ul>
                      : <ul className="text-xs text-slate-600 space-y-0.5">
                          {Object.entries(selectedScenario.evaluation_criteria).map(([k, v]) => (
                            <li key={k}><span className="font-medium">{k}:</span> {String(v)}</li>
                          ))}
                        </ul>
                  }
                </div>
              )}
            </Card>
          )}

          <ChatConsole
            key={selectedKey ?? 'free'}
            agentId={agentId}
            title={selectedKey ? `Testing scenario ${selectedKey}` : 'Free chat'}
            subtitle={selectedKey
              ? 'The scenario prompt is pre-filled below. Send it to see how the agent responds.'
              : 'Send any message to test the agent before going live.'}
            heightClass="h-[480px]"
            initialPrompt={initialPrompt}
          />
        </div>
      </div>
    </div>
  )
}
