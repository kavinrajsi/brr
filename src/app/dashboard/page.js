'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { Card } from '@/components/ui/card'
import { useAuth } from '@/contexts/AuthContext'
import { apiCall } from '@/lib/api-client'
import { LoadingCard } from '@/components/dashboard/LoadingCard'

// Lazy-load heavier dashboard widgets — keeps the initial bundle small
const AgentMetrics = dynamic(
  () => import('@/components/dashboard/AgentMetrics').then(m => m.AgentMetrics),
  { loading: () => <LoadingCard />, ssr: false }
)
const TrainingChart = dynamic(
  () => import('@/components/dashboard/TrainingChart').then(m => m.TrainingChart),
  { loading: () => <LoadingCard />, ssr: false }
)

export default function DashboardPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    apiCall('/api/dashboard/stats')
      .then(data => setStats(data.stats))
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [])

  const successRate = stats && stats.totalAgents > 0
    ? Math.round((stats.certified / stats.totalAgents) * 100)
    : null

  const statCards = [
    { label: 'Total Brands',    value: stats?.totalBrands ?? 0,  color: 'text-slate-900',  hint: 'Across your account' },
    { label: 'Deployed Agents', value: stats?.certified ?? 0,    color: 'text-green-600',  hint: 'Certified and live' },
    { label: 'In Training',     value: stats?.inTraining ?? 0,   color: 'text-blue-600',   hint: 'Currently training' },
    { label: 'Success Rate',    value: successRate !== null ? `${successRate}%` : '—', color: successRate !== null ? 'text-slate-900' : 'text-slate-400', hint: 'Certified / total agents' },
  ]

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-600 mt-2">Welcome to BRR AI Training System</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map(card => (
          <Card key={card.label} className="p-6 bg-white">
            <p className="text-sm text-slate-600 font-medium">{card.label}</p>
            {isLoading ? (
              <div className="h-9 w-16 bg-slate-200 rounded animate-pulse mt-2" />
            ) : (
              <p className={`text-3xl font-bold mt-2 ${card.color}`}>{card.value}</p>
            )}
            <p className="text-xs text-slate-500 mt-2">{card.hint}</p>
          </Card>
        ))}
      </div>

      {/* Heavy chart widgets load after the stats are visible */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <AgentMetrics />
        <TrainingChart />
      </div>

      <Card className="p-8 bg-linear-to-br from-slate-50 to-slate-100">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">
          Welcome, {user?.email}!
        </h2>
        <p className="text-slate-700 mb-6">
          You&apos;re all set up. Here&apos;s what you can do next:
        </p>
        <ul className="space-y-3 text-slate-700">
          <li className="flex items-start">
            <span className="text-green-600 font-bold mr-3">✓</span>
            <span>
              <strong>Create a Brand: </strong> Go to &quot;Brands&quot; to configure your first brand with its BRR
            </span>
          </li>
          <li className="flex items-start">
            <span className="text-green-600 font-bold mr-3">✓</span>
            <span>
              <strong>Train an Agent:</strong> Upload your brand config and start the 8-week training process
            </span>
          </li>
          <li className="flex items-start">
            <span className="text-green-600 font-bold mr-3">✓</span>
            <span>
              <strong>Monitor Progress:</strong> Track training stages from onboarding to deployment
            </span>
          </li>
          <li className="flex items-start">
            <span className="text-green-600 font-bold mr-3">✓</span>
            <span>
              <strong>Deploy:</strong> Once certified, deploy your agent to production
            </span>
          </li>
        </ul>
      </Card>
    </div>
  )
}
