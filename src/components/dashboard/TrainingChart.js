'use client'

import { useAgents } from '@/hooks/useAgents'
import { Card } from '@/components/ui/card'

const STAGE_NAMES = [
  'Onboarding',
  'Supervised Training',
  'Probation',
  'Certification',
  'Deployment',
  'Ongoing Learning',
]

export function TrainingChart() {
  const { agents, isLoading } = useAgents()

  if (isLoading) {
    return (
      <Card className="p-6 bg-white">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Training Progress</h3>
        <div className="space-y-4">
          {STAGE_NAMES.map((_, i) => (
            <div key={i} className="animate-pulse flex items-center gap-3">
              <div className="h-3 bg-slate-200 rounded w-28 shrink-0" />
              <div className="h-2 bg-slate-200 rounded flex-1" />
              <div className="h-3 bg-slate-200 rounded w-4 shrink-0" />
            </div>
          ))}
        </div>
      </Card>
    )
  }

  const trainingAgents = agents.filter(a => a.status === 'Training')

  if (trainingAgents.length === 0) {
    return (
      <Card className="p-6 bg-white">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Training Progress</h3>
        <p className="text-slate-500 text-sm">No agents in training. Start training an agent to see progress here.</p>
      </Card>
    )
  }

  const stageCounts = STAGE_NAMES.map((name, i) => ({
    stage: i + 1,
    name,
    count: trainingAgents.filter(a => a.current_stage === i + 1).length,
  }))

  const maxCount = Math.max(...stageCounts.map(s => s.count), 1)

  return (
    <Card className="p-6 bg-white">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-lg font-semibold text-slate-900">Training Progress</h3>
        <span className="text-sm text-slate-500">{trainingAgents.length} in training</span>
      </div>
      <div className="space-y-3">
        {stageCounts.map(({ stage, name, count }) => (
          <div key={stage} className="flex items-center gap-3">
            <div className="w-32 shrink-0">
              <p className="text-xs font-medium text-slate-700 truncate">{name}</p>
              <p className="text-xs text-slate-400">Stage {stage}</p>
            </div>
            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                style={{ width: count === 0 ? '0%' : `${(count / maxCount) * 100}%` }}
              />
            </div>
            <span className="text-sm font-semibold text-slate-700 w-4 text-right shrink-0">
              {count}
            </span>
          </div>
        ))}
      </div>
    </Card>
  )
}
