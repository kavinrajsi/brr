'use client'

import { useState } from 'react'
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
  const { agents, isLoading, error, deleteAgent } = useAgents()
  const [deletingId, setDeletingId] = useState(null)

  async function handleDelete(agent) {
    if (!confirm(`Delete agent "${agent.name}"? This cannot be undone.`)) return
    setDeletingId(agent.id)
    try {
      await deleteAgent(agent.id)
    } finally {
      setDeletingId(null)
    }
  }

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
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/dashboard/brands/${agent.brand_id}/agents/${agent.id}`}>
                        <Button variant="outline" size="icon-sm" title="View Training">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
                        </Button>
                      </Link>
                      <Button
                        variant="destructive"
                        size="icon-sm"
                        title="Delete Agent"
                        disabled={deletingId === agent.id}
                        onClick={() => handleDelete(agent)}
                      >
                        {deletingId === agent.id
                          ? <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                          : <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                        }
                      </Button>
                    </div>
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
