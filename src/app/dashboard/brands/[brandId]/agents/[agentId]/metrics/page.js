'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useTraining } from '@/hooks/useTraining'
import { apiCall } from '@/lib/api-client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

const STAGE_NAMES = ['Onboarding', 'Supervised Training', 'Probation', 'Certification', 'Deployment', 'Ongoing Learning']

const STATUS_CONFIG = {
  Pending:     { dot: 'bg-slate-300',  text: 'text-slate-500'  },
  'In Progress': { dot: 'bg-blue-500',   text: 'text-blue-700'   },
  Complete:    { dot: 'bg-green-500',  text: 'text-green-700'  },
  Failed:      { dot: 'bg-red-500',    text: 'text-red-700'    },
}

function Stage2Breakdown({ stages }) {
  const stage2 = stages.find(s => s.stage === 2)
  if (!stage2?.test_scores) return null

  const TEST_SETS = [
    { set: 'A', title: 'Writing & Tone',          count: 6 },
    { set: 'B', title: 'Design & Photography',    count: 6 },
    { set: 'C', title: 'Brand Fit & Consistency', count: 5 },
    { set: 'D', title: 'Checklist Mastery',       count: 3 },
    { set: 'E', title: 'Real Client Scenarios',   count: 5 },
  ]

  return (
    <Card className="p-6">
      <h2 className="text-lg font-bold text-slate-900 mb-4">Stage 2 Test Breakdown</h2>
      <div className="space-y-3">
        {TEST_SETS.map(ts => {
          const passed = Array.from({ length: ts.count }, (_, i) =>
            stage2.test_scores[`${ts.set}${i + 1}`] === 'pass'
          ).filter(Boolean).length
          const pct = Math.round((passed / ts.count) * 100)
          return (
            <div key={ts.set}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-700">Set {ts.set}: {ts.title}</span>
                <span className={`font-semibold ${pct === 100 ? 'text-green-600' : pct >= 80 ? 'text-blue-600' : 'text-red-600'}`}>
                  {passed}/{ts.count}
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${pct >= 80 ? 'bg-green-500' : 'bg-red-400'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

export default function AgentMetricsPage() {
  const { brandId, agentId } = useParams()
  const { stages, isLoading: trainingLoading } = useTraining(agentId)
  const [agent, setAgent] = useState(null)
  const [agentLoading, setAgentLoading] = useState(true)

  useEffect(() => {
    apiCall(`/api/agents/${agentId}`)
      .then(setAgent)
      .catch(() => {})
      .finally(() => setAgentLoading(false))
  }, [agentId])

  const isLoading = agentLoading || trainingLoading

  if (isLoading) {
    return <Card className="p-12 text-center"><p className="text-slate-600">Loading…</p></Card>
  }

  if (!agent) {
    return (
      <Card className="p-12 text-center bg-red-50 border-red-200">
        <p className="text-red-800 mb-4">Agent not found</p>
        <Link href={`/dashboard/brands/${brandId}/training`}>
          <Button variant="outline">Back</Button>
        </Link>
      </Card>
    )
  }

  const completedStages = stages.filter(s => s.status === 'Complete')
  const progress = Math.round((completedStages.length / 6) * 100)

  const stage2 = stages.find(s => s.stage === 2)
  const stage2Passed = stage2?.test_scores
    ? Object.values(stage2.test_scores).filter(v => v === 'pass').length
    : 0
  const stage2Pct = Math.round((stage2Passed / 25) * 100)

  return (
    <div>
      <div className="mb-8">
        <Link href={`/dashboard/brands/${brandId}/agents/${agentId}`} className="text-slate-600 hover:text-slate-900 mb-4 inline-block">
          ← Back to Training
        </Link>
        <h1 className="text-3xl font-bold text-slate-900">Metrics</h1>
        <p className="text-slate-600 mt-1">{agent.name}</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card className="p-5">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Progress</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">{progress}%</p>
          <p className="text-xs text-slate-500 mt-1">{completedStages.length}/6 stages</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Status</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{agent.status}</p>
          <p className="text-xs text-slate-500 mt-1">Stage {agent.current_stage}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Test Score</p>
          <p className={`text-3xl font-bold mt-1 ${stage2Pct >= 80 ? 'text-green-600' : stage2Pct > 0 ? 'text-yellow-600' : 'text-slate-400'}`}>
            {stage2Pct > 0 ? `${stage2Pct}%` : '—'}
          </p>
          <p className="text-xs text-slate-500 mt-1">{stage2Passed > 0 ? `${stage2Passed}/25 passed` : 'Stage 2 not started'}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Certified</p>
          <p className="text-sm font-bold text-slate-900 mt-1">
            {agent.certified_at ? new Date(agent.certified_at).toLocaleDateString() : '—'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {agent.deployed_at ? `Deployed ${new Date(agent.deployed_at).toLocaleDateString()}` : 'Not deployed'}
          </p>
        </Card>
      </div>

      {/* Stage timeline */}
      <Card className="p-6 mb-6">
        <h2 className="text-lg font-bold text-slate-900 mb-5">Training Timeline</h2>
        <div className="relative">
          {stages.map((stage, idx) => {
            const cfg = STATUS_CONFIG[stage.status] ?? STATUS_CONFIG.Pending
            return (
              <div key={stage.stage} className="flex gap-4 mb-5 last:mb-0">
                <div className="flex flex-col items-center">
                  <div className={`w-3 h-3 rounded-full mt-1 shrink-0 ${cfg.dot}`} />
                  {idx < stages.length - 1 && <div className="w-0.5 bg-slate-200 flex-1 mt-1" />}
                </div>
                <div className="pb-2 flex-1">
                  <div className="flex items-center justify-between">
                    <p className={`text-sm font-semibold ${cfg.text}`}>
                      Stage {stage.stage}: {STAGE_NAMES[stage.stage - 1]}
                    </p>
                    <span className={`text-xs font-medium ${cfg.text}`}>{stage.status}</span>
                  </div>
                  {stage.completed_at && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      Completed {new Date(stage.completed_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      <Stage2Breakdown stages={stages} />
    </div>
  )
}
