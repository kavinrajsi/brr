'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { apiCall } from '@/lib/api-client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'

const ROLES = ['admin', 'member', 'viewer']

const ROLE_STYLES = {
  owner:  'bg-purple-100 text-purple-800',
  admin:  'bg-blue-100 text-blue-800',
  member: 'bg-green-100 text-green-800',
  viewer: 'bg-gray-100 text-gray-800',
}

export default function MembersPage() {
  const { orgId } = useParams()
  const [members, setMembers] = useState([])
  const [invites, setInvites] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'member' })
  const [isSending, setIsSending] = useState(false)
  const [inviteSuccess, setInviteSuccess] = useState('')

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const [{ members: m }, { invites: i }] = await Promise.all([
        apiCall(`/api/organizations/${orgId}/members`),
        apiCall(`/api/organizations/${orgId}/invites`),
      ])
      setMembers(m ?? [])
      setInvites((i ?? []).filter(inv => !inv.accepted_at))
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [orgId])

  useEffect(() => { load() }, [load])

  const handleRemoveMember = async (memberId) => {
    if (!window.confirm('Remove this member?')) return
    try {
      await apiCall(`/api/organizations/${orgId}/members`, {
        method: 'DELETE',
        body: JSON.stringify({ memberId }),
      })
      setMembers(prev => prev.filter(m => m.id !== memberId))
    } catch (err) {
      setError(err.message)
    }
  }

  const handleChangeRole = async (memberId, role) => {
    try {
      const updated = await apiCall(`/api/organizations/${orgId}/members`, {
        method: 'PATCH',
        body: JSON.stringify({ memberId, role }),
      })
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: updated.role } : m))
    } catch (err) {
      setError(err.message)
    }
  }

  const handleInvite = async (e) => {
    e.preventDefault()
    setError('')
    setInviteSuccess('')
    if (!inviteForm.email.trim()) return setError('Email is required')
    setIsSending(true)
    try {
      await apiCall(`/api/organizations/${orgId}/invites`, {
        method: 'POST',
        body: JSON.stringify(inviteForm),
      })
      setInviteSuccess(`Invite sent to ${inviteForm.email}`)
      setInviteForm({ email: '', role: 'member' })
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setIsSending(false)
    }
  }

  const handleRevokeInvite = async (inviteId) => {
    try {
      await apiCall(`/api/organizations/${orgId}/invites`, {
        method: 'DELETE',
        body: JSON.stringify({ inviteId }),
      })
      setInvites(prev => prev.filter(i => i.id !== inviteId))
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div>
      <div className="mb-8">
        <Link href={`/dashboard/organizations/${orgId}`} className="text-slate-600 hover:text-slate-900 mb-4 inline-block">
          ← Back to Settings
        </Link>
        <h1 className="text-3xl font-bold text-slate-900">Members</h1>
        <p className="text-slate-600 mt-2">Manage who has access to this organization</p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Invite form */}
      <Card className="p-6 mb-6 max-w-xl">
        <h2 className="font-semibold text-slate-900 mb-4">Invite Someone</h2>

        {inviteSuccess && (
          <Alert className="mb-4 bg-green-50 border-green-200">
            <AlertDescription className="text-green-800">{inviteSuccess}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleInvite} className="flex gap-3 items-end">
          <div className="flex-1">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="colleague@example.com"
              value={inviteForm.email}
              onChange={e => setInviteForm(p => ({ ...p, email: e.target.value }))}
              disabled={isSending}
              className="mt-2"
            />
          </div>
          <div>
            <Label htmlFor="role">Role</Label>
            <select
              id="role"
              value={inviteForm.role}
              onChange={e => setInviteForm(p => ({ ...p, role: e.target.value }))}
              disabled={isSending}
              className="mt-2 block w-28 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <Button type="submit" disabled={isSending}>
            {isSending ? 'Sending…' : 'Send Invite'}
          </Button>
        </form>
      </Card>

      {/* Members table */}
      {isLoading ? (
        <Card className="p-8 text-center"><p className="text-slate-600">Loading…</p></Card>
      ) : (
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <div className="px-6 py-3 bg-slate-50 border-b border-slate-200">
              <p className="text-sm font-medium text-slate-700">Members ({members.length})</p>
            </div>
            {members.length === 0 ? (
              <p className="px-6 py-8 text-sm text-slate-500 text-center">No members yet</p>
            ) : (
              <table className="w-full">
                <tbody className="divide-y divide-slate-200">
                  {members.map(m => (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 text-sm text-slate-700 font-mono">{m.user_id}</td>
                      <td className="px-6 py-4">
                        {m.role === 'owner' ? (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_STYLES.owner}`}>owner</span>
                        ) : (
                          <select
                            value={m.role}
                            onChange={e => handleChangeRole(m.id, e.target.value)}
                            className="text-xs rounded border border-slate-200 px-2 py-1 bg-white"
                          >
                            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500">
                        Joined {new Date(m.joined_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {m.role !== 'owner' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemoveMember(m.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            Remove
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          {/* Pending invites */}
          {invites.length > 0 && (
            <Card className="overflow-hidden">
              <div className="px-6 py-3 bg-slate-50 border-b border-slate-200">
                <p className="text-sm font-medium text-slate-700">Pending Invites ({invites.length})</p>
              </div>
              <table className="w-full">
                <tbody className="divide-y divide-slate-200">
                  {invites.map(inv => (
                    <tr key={inv.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 text-sm text-slate-700">{inv.email}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_STYLES[inv.role] ?? ROLE_STYLES.member}`}>
                          {inv.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500">
                        Expires {new Date(inv.expires_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRevokeInvite(inv.id)}
                          className="text-slate-600"
                        >
                          Revoke
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
