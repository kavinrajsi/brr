'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { apiCall } from '@/lib/api-client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const ACTION_COLORS = {
  organization_created:    'bg-green-100 text-green-800',
  organization_updated:    'bg-blue-100 text-blue-800',
  member_invited:          'bg-purple-100 text-purple-800',
  member_joined_via_invite:'bg-purple-100 text-purple-800',
  member_removed:          'bg-red-100 text-red-800',
  member_role_changed:     'bg-yellow-100 text-yellow-800',
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState([])
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 0 })
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (page = 1) => {
    setIsLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ page })
      if (query) params.set('action', query)
      const res = await apiCall(`/api/admin/audit?${params}`)
      setLogs(res.logs)
      setPagination(res.pagination)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [query])

  useEffect(() => { load(1) }, [load])

  const handleSearch = (e) => {
    e.preventDefault()
    setQuery(search)
  }

  return (
    <div>
      <div className="mb-8">
        <Link href="/dashboard/admin" className="text-slate-600 hover:text-slate-900 mb-4 inline-block">
          ← Back to Admin
        </Link>
        <h1 className="text-3xl font-bold text-slate-900">Audit Logs</h1>
        <p className="text-slate-600 mt-2">Track all actions across your organizations</p>
      </div>

      {error && (
        <Card className="p-4 mb-6 bg-red-50 border-red-200">
          <p className="text-red-800">Error: {error}</p>
        </Card>
      )}

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-3 mb-6 max-w-md">
        <Input
          placeholder="Filter by action…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <Button type="submit" variant="outline">Filter</Button>
        {query && (
          <Button type="button" variant="outline" onClick={() => { setSearch(''); setQuery('') }}>
            Clear
          </Button>
        )}
      </form>

      <Card className="overflow-hidden">
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <p className="text-sm text-slate-600">{pagination.total} total events</p>
          {pagination.pages > 1 && (
            <p className="text-sm text-slate-500">Page {pagination.page} of {pagination.pages}</p>
          )}
        </div>

        {isLoading ? (
          <p className="px-6 py-12 text-sm text-slate-500 text-center">Loading…</p>
        ) : logs.length === 0 ? (
          <p className="px-6 py-12 text-sm text-slate-500 text-center">No audit logs found</p>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Action', 'Resource', 'User', 'Date'].map(h => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {logs.map(log => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="px-6 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ACTION_COLORS[log.action] ?? 'bg-gray-100 text-gray-700'}`}>
                      {log.action.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-sm text-slate-600">
                    {log.resource_type && (
                      <span className="capitalize">{log.resource_type}</span>
                    )}
                    {log.resource_id && (
                      <span className="text-slate-400 ml-1 font-mono text-xs">
                        {log.resource_id.slice(0, 8)}…
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-xs text-slate-500 font-mono">
                    {log.user_id?.slice(0, 8)}…
                  </td>
                  <td className="px-6 py-3 text-sm text-slate-500 whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {pagination.pages > 1 && (
          <div className="px-6 py-4 border-t border-slate-200 flex justify-between">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1 || isLoading}
              onClick={() => load(pagination.page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.pages || isLoading}
              onClick={() => load(pagination.page + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}
