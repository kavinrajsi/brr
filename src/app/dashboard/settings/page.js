'use client'

import { Card } from '@/components/ui/card'
import { useAuth } from '@/contexts/AuthContext'

export default function SettingsPage() {
  const { user } = useAuth()

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-600 mt-2">Manage your account settings</p>
      </div>

      <Card className="p-8 bg-white">
        <h2 className="text-lg font-bold text-slate-900 mb-6">Account Information</h2>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-slate-600 font-medium">Email</p>
            <p className="text-slate-900 font-medium mt-1">{user?.email}</p>
          </div>
          <div>
            <p className="text-sm text-slate-600 font-medium">Account Status</p>
            <p className="text-slate-900 font-medium mt-1">Active</p>
          </div>
          <div>
            <p className="text-sm text-slate-600 font-medium">Member Since</p>
            <p className="text-slate-900 font-medium mt-1">Today</p>
          </div>
        </div>
      </Card>
    </div>
  )
}
