'use client'

import { useAgents } from '@/hooks/useAgents'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

const STATUS_STYLES = {
  Training:  'bg-blue-100 text-blue-800',
  Certified: 'bg-green-100 text-green-800',
  Deployed:  'bg-purple-100 text-purple-800',
}

export default function AgentsPage() {
  const { agents, isLoading, error } = useAgents()

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Agents</h1>
        <p className="text-slate-600 mt-2">All AI agents across your brands</p>
      </div>

      {error && (
        <Card className="p-4 mb-6 bg-red-50 border-red-200">
          <p className="text-red-800">Error: {error}</p>
        </Card>
      )}

      {isLoading && (
        <Card className="p-12 text-center">
          <p className="text-slate-600">Loading agents…</p>
        </Card>
      )}

      {!isLoading && agents.length === 0 && (
        <Card className="p-12 text-center bg-slate-50">
          <p className="text-slate-600 mb-2">No agents yet</p>
          <p className="text-sm text-slate-400 mb-6">Go to a brand and click &quot;View Training&quot; to create one</p>
          <Link href="/dashboard/brands">
            <Button>Go to Brands</Button>
          </Link>
        </Card>
      )}

      {!isLoading && agents.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Agent', 'Brand', 'Status', 'Stage', 'Created', ''].map(h => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider last:text-right">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {agents.map(agent => (
                <tr key={agent.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium text-slate-900">{agent.name}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{agent.brands?.name}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[agent.status] ?? STATUS_STYLES.Training}`}>
                      {agent.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-900">{agent.current_stage}/6</td>
                  <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">
                    {new Date(agent.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link href={`/dashboard/brands/${agent.brand_id}/agents/${agent.id}`}>
                      <Button variant="outline" size="sm">View Training</Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
