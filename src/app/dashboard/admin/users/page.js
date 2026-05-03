'use client'

import { useState, useEffect } from 'react'
import { apiCall } from '@/lib/api-client'
import { Card } from '@/components/ui/card'

const STATUS_STYLES = {
  active:    'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  free:      'bg-gray-100 text-gray-600',
}

const PLAN_STYLES = {
  Free:       'bg-gray-100 text-gray-700',
  Pro:        'bg-blue-100 text-blue-700',
  Enterprise: 'bg-purple-100 text-purple-700',
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    apiCall('/api/admin/users')
      .then(data => setUsers(data.users ?? []))
      .catch(err => setError(err.message))
      .finally(() => setIsLoading(false))
  }, [])

  const totalRevenue = users.reduce((sum, u) => sum + (u.subscription_status === 'active' ? u.plan_price : 0), 0)
  const activeSubscribers = users.filter(u => u.subscription_status === 'active').length

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Users & Payments</h1>
        <p className="text-slate-600 mt-2">All registered users and their subscription status</p>
      </div>

      {error && (
        <Card className="p-4 mb-6 bg-red-50 border-red-200">
          <p className="text-red-800">Error: {error}</p>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Total Users',        value: isLoading ? '—' : users.length,         color: 'text-slate-900' },
          { label: 'Active Subscribers', value: isLoading ? '—' : activeSubscribers,    color: 'text-green-600' },
          { label: 'MRR',                value: isLoading ? '—' : `$${totalRevenue}`,   color: 'text-blue-600' },
        ].map(s => (
          <Card key={s.label} className="p-4 bg-white">
            <p className="text-xs text-slate-500 font-medium">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <p className="px-6 py-8 text-sm text-slate-500 text-center">Loading…</p>
        ) : users.length === 0 ? (
          <p className="px-6 py-8 text-sm text-slate-500 text-center">No users found</p>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Email', 'Plan', 'Status', 'Monthly', 'Renews', 'Joined', 'Last Sign In'].map(h => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">{u.email}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${PLAN_STYLES[u.plan] ?? PLAN_STYLES.Free}`}>
                      {u.plan}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[u.subscription_status] ?? STATUS_STYLES.free}`}>
                      {u.subscription_status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    {u.plan_price > 0 ? `$${u.plan_price}` : '—'}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">
                    {u.current_period_end ? new Date(u.current_period_end).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500 whitespace-nowrap">
                    {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString() : '—'}
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
