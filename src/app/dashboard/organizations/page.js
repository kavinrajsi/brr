'use client'

import Link from 'next/link'
import { useOrganizations } from '@/hooks/useOrganizations'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const ROLE_STYLES = {
  owner:  'bg-purple-100 text-purple-800',
  admin:  'bg-blue-100 text-blue-800',
  member: 'bg-green-100 text-green-800',
  viewer: 'bg-gray-100 text-gray-800',
}

const PLAN_STYLES = {
  free:       'bg-gray-100 text-gray-700',
  pro:        'bg-blue-100 text-blue-700',
  enterprise: 'bg-amber-100 text-amber-700',
}

export default function OrganizationsPage() {
  const { organizations, isLoading, error } = useOrganizations()

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Organizations</h1>
          <p className="text-slate-600 mt-2">Manage teams and collaborate on brands</p>
        </div>
        <Link href="/dashboard/organizations/new">
          <Button>+ New Organization</Button>
        </Link>
      </div>

      {error && (
        <Card className="p-4 mb-6 bg-red-50 border-red-200">
          <p className="text-red-800">Error: {error}</p>
        </Card>
      )}

      {isLoading && (
        <Card className="p-12 text-center">
          <p className="text-slate-600">Loading organizations...</p>
        </Card>
      )}

      {!isLoading && organizations.length === 0 && (
        <Card className="p-12 text-center bg-slate-50">
          <p className="text-2xl mb-2">🏢</p>
          <p className="text-slate-700 font-medium mb-2">No organizations yet</p>
          <p className="text-slate-500 text-sm mb-6">Create one to start collaborating with your team</p>
          <Link href="/dashboard/organizations/new">
            <Button>Create Your First Organization</Button>
          </Link>
        </Card>
      )}

      {!isLoading && organizations.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {organizations.map(org => (
            <Card key={org.id} className="p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-xl shrink-0">
                  🏢
                </div>
                <div className="flex gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PLAN_STYLES[org.plan] ?? PLAN_STYLES.free}`}>
                    {org.plan}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_STYLES[org.role] ?? ROLE_STYLES.member}`}>
                    {org.role}
                  </span>
                </div>
              </div>

              <h3 className="font-semibold text-slate-900 mb-1">{org.name}</h3>
              <p className="text-xs text-slate-500 mb-4">/{org.slug}</p>

              <div className="flex gap-2">
                <Link href={`/dashboard/organizations/${org.id}`} className="flex-1">
                  <Button variant="outline" size="sm" className="w-full">Settings</Button>
                </Link>
                <Link href={`/dashboard/organizations/${org.id}/members`} className="flex-1">
                  <Button size="sm" className="w-full">Members</Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
