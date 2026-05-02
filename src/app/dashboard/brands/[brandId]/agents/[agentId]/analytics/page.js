'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { apiCall } from '@/lib/api-client'
import { Card } from '@/components/ui/card'
import Link from 'next/link'

function StatCard({ label, value, loading }) {
  if (loading) {
    return (
      <Card className="p-6">
        <div className="h-4 w-32 bg-slate-200 rounded animate-pulse mb-3" />
        <div className="h-8 w-20 bg-slate-100 rounded animate-pulse" />
      </Card>
    )
  }
  return (
    <Card className="p-6">
      <p className="text-sm font-medium text-slate-500 mb-1">{label}</p>
      <p className="text-3xl font-bold text-slate-900">{value ?? '—'}</p>
    </Card>
  )
}

export default function AgentAnalyticsPage() {
  const { brandId, agentId } = useParams()
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)

  useEffect(() => {
    apiCall(`/api/agents/${agentId}/analytics`)
      .then(setAnalytics)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [agentId])

  const stats = [
    { label: 'Total Conversations',         value: analytics?.total_conversations },
    { label: 'Total Messages',              value: analytics?.total_messages },
    { label: 'Escalations',                 value: analytics?.escalations },
    { label: 'Avg Messages / Conversation', value: analytics?.avg_messages_per_conversation != null
        ? Number(analytics.avg_messages_per_conversation).toFixed(2)
        : null },
  ]

  const daily = analytics?.daily ?? []

  return (
    <div>
      <div className="mb-8">
        <Link
          href={`/dashboard/brands/${brandId}/agents/${agentId}`}
          className="text-slate-600 hover:text-slate-900 mb-4 inline-block"
        >
          ← Back to Agent
        </Link>
        <h1 className="text-3xl font-bold text-slate-900">Analytics</h1>
        <p className="text-slate-600 mt-1">30-day activity overview</p>
      </div>

      {error && (
        <Card className="p-6 mb-8 bg-red-50 border-red-200">
          <p className="text-sm text-red-800">{error}</p>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {stats.map(s => (
          <StatCard key={s.label} label={s.label} value={s.value} loading={loading} />
        ))}
      </div>

      <Card className="p-6">
        <h2 className="font-bold text-slate-900 mb-4">Daily Activity</h2>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-8 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        ) : daily.length === 0 ? (
          <p className="text-sm text-slate-400">No activity data yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-3 font-semibold text-slate-600">Day</th>
                  <th className="text-right py-2 px-3 font-semibold text-slate-600">Conversations</th>
                  <th className="text-right py-2 px-3 font-semibold text-slate-600">Messages</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {daily.map(row => (
                  <tr key={row.day} className="hover:bg-slate-50">
                    <td className="py-2 px-3 text-slate-700 font-mono">{row.day}</td>
                    <td className="py-2 px-3 text-right text-slate-900">{row.conversations}</td>
                    <td className="py-2 px-3 text-right text-slate-900">{row.messages}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
