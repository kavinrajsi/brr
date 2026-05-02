'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { apiCall } from '@/lib/api-client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const STATUS_STYLES = {
  Draft:    'bg-gray-100 text-gray-700',
  Config:   'bg-blue-100 text-blue-700',
  Training: 'bg-yellow-100 text-yellow-700',
  Deployed: 'bg-green-100 text-green-700',
}

export default function AdminPage() {
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    apiCall('/api/admin/stats')
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setIsLoading(false))
  }, [])

  const statCards = data ? [
    { label: 'Total Brands',     value: data.stats.totalBrands,    color: 'text-slate-900' },
    { label: 'Total Agents',     value: data.stats.totalAgents,    color: 'text-slate-900' },
    { label: 'In Training',      value: data.stats.inTraining,     color: 'text-blue-600' },
    { label: 'Certified',        value: data.stats.certified,      color: 'text-green-600' },
    { label: 'Organizations',    value: data.stats.totalOrgs,      color: 'text-purple-600' },
    { label: 'Test Scenarios',   value: data.stats.totalScenarios, color: 'text-amber-600' },
  ] : []

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Admin</h1>
          <p className="text-slate-600 mt-2">Overview of your account activity</p>
        </div>
        <Link href="/dashboard/admin/audit">
          <Button variant="outline">View Audit Logs</Button>
        </Link>
      </div>

      {error && (
        <Card className="p-4 mb-6 bg-red-50 border-red-200">
          <p className="text-red-800">Error: {error}</p>
        </Card>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="p-4 animate-pulse">
                <div className="h-3 bg-gray-200 rounded w-3/4 mb-3" />
                <div className="h-7 bg-gray-200 rounded w-1/2" />
              </Card>
            ))
          : statCards.map(s => (
              <Card key={s.label} className="p-4 bg-white">
                <p className="text-xs text-slate-500 font-medium">{s.label}</p>
                <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
              </Card>
            ))
        }
      </div>

      {/* Recent brands */}
      <Card className="overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Recent Brands</h2>
          <Link href="/dashboard/brands">
            <Button variant="outline" size="sm">View All</Button>
          </Link>
        </div>

        {isLoading ? (
          <p className="px-6 py-8 text-sm text-slate-500 text-center">Loading…</p>
        ) : !data?.recentBrands?.length ? (
          <p className="px-6 py-8 text-sm text-slate-500 text-center">No brands yet</p>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Name', 'Status', 'Stage', 'Created'].map(h => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {data.recentBrands.map(brand => (
                <tr key={brand.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <Link href={`/dashboard/brands/${brand.id}`} className="font-medium text-slate-900 hover:underline">
                      {brand.name}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[brand.status] ?? STATUS_STYLES.Draft}`}>
                      {brand.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">{brand.current_stage}/6</td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {new Date(brand.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
