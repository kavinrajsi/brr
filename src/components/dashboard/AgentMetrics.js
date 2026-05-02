'use client'

import { useAgents } from '@/hooks/useAgents'
import { Card } from '@/components/ui/card'

const STATUS_COLORS = {
  Certified: { dot: 'bg-green-500', bar: 'bg-green-400', text: 'text-green-700' },
  Training:  { dot: 'bg-blue-500',  bar: 'bg-blue-400',  text: 'text-blue-700'  },
}
const FALLBACK_COLOR = { dot: 'bg-slate-400', bar: 'bg-slate-300', text: 'text-slate-600' }

export function AgentMetrics() {
  const { agents, isLoading } = useAgents()

  if (isLoading) {
    return (
      <Card className="p-6 bg-white">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Agent Metrics</h3>
        <div className="space-y-4">
          {[1, 2].map(i => (
            <div key={i} className="animate-pulse">
              <div className="flex justify-between mb-1">
                <div className="h-3 bg-slate-200 rounded w-20" />
                <div className="h-3 bg-slate-200 rounded w-6" />
              </div>
              <div className="h-2 bg-slate-200 rounded-full w-full" />
            </div>
          ))}
        </div>
      </Card>
    )
  }

  if (agents.length === 0) {
    return (
      <Card className="p-6 bg-white">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Agent Metrics</h3>
        <p className="text-slate-500 text-sm">No agents yet. Create your first agent to see metrics here.</p>
      </Card>
    )
  }

  const breakdown = agents.reduce((acc, agent) => {
    acc[agent.status] = (acc[agent.status] || 0) + 1
    return acc
  }, {})

  const total = agents.length
  const entries = Object.entries(breakdown).sort((a, b) => b[1] - a[1])

  return (
    <Card className="p-6 bg-white">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-lg font-semibold text-slate-900">Agent Metrics</h3>
        <span className="text-sm text-slate-500">{total} total</span>
      </div>
      <div className="space-y-4">
        {entries.map(([status, count]) => {
          const cfg = STATUS_COLORS[status] ?? FALLBACK_COLOR
          const pct = Math.round((count / total) * 100)
          return (
            <div key={status}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                  <span className="text-sm font-medium text-slate-700">{status}</span>
                </div>
                <span className={`text-sm font-semibold ${cfg.text}`}>{count}</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${cfg.bar}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">{pct}% of agents</p>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
