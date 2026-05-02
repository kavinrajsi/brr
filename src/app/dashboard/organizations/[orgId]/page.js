'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiCall } from '@/lib/api-client'
import { useOrganizations } from '@/hooks/useOrganizations'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function OrganizationSettingsPage() {
  const { orgId } = useParams()
  const router = useRouter()
  const { deleteOrganization } = useOrganizations()
  const [org, setOrg] = useState(null)
  const [form, setForm] = useState({ name: '', description: '', website: '' })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    apiCall(`/api/organizations/${orgId}`)
      .then(data => {
        setOrg(data)
        setForm({ name: data.name, description: data.description ?? '', website: data.website ?? '' })
      })
      .catch(err => setError(err.message))
      .finally(() => setIsLoading(false))
  }, [orgId])

  const handleSave = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!form.name.trim()) return setError('Name is required')
    setIsSaving(true)
    try {
      await apiCall(`/api/organizations/${orgId}`, {
        method: 'PUT',
        body: JSON.stringify(form),
      })
      setSuccess('Settings saved')
    } catch (err) {
      setError(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Delete this organization? This cannot be undone.')) return
    setIsDeleting(true)
    try {
      await deleteOrganization(orgId)
      router.push('/dashboard/organizations')
    } catch (err) {
      setError(err.message)
      setIsDeleting(false)
    }
  }

  if (isLoading) return <Card className="p-12 text-center"><p className="text-slate-600">Loading…</p></Card>

  return (
    <div>
      <div className="mb-8">
        <Link href="/dashboard/organizations" className="text-slate-600 hover:text-slate-900 mb-4 inline-block">
          ← Back to Organizations
        </Link>
        <h1 className="text-3xl font-bold text-slate-900">{org?.name}</h1>
        <p className="text-slate-500 text-sm mt-1">/{org?.slug}</p>
      </div>

      <div className="max-w-lg space-y-6">
        <Card className="p-6">
          <h2 className="font-semibold text-slate-900 mb-4">General Settings</h2>

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert className="mb-4 bg-green-50 border-green-200">
              <AlertDescription className="text-green-800">{success}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                disabled={isSaving}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                disabled={isSaving}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                placeholder="https://example.com"
                value={form.website}
                onChange={e => setForm(p => ({ ...p, website: e.target.value }))}
                disabled={isSaving}
                className="mt-2"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Link href={`/dashboard/organizations/${orgId}/members`}>
                <Button variant="outline" type="button">View Members</Button>
              </Link>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Saving…' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </Card>

        <Card className="p-6 border-red-200">
          <h2 className="font-semibold text-red-900 mb-2">Danger Zone</h2>
          <p className="text-sm text-slate-600 mb-4">
            Deleting an organization removes all members and associated data permanently.
          </p>
          <Button
            variant="outline"
            onClick={handleDelete}
            disabled={isDeleting}
            className="border-red-300 text-red-600 hover:bg-red-50"
          >
            {isDeleting ? 'Deleting…' : 'Delete Organization'}
          </Button>
        </Card>
      </div>
    </div>
  )
}
