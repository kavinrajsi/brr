'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useOrganizations } from '@/hooks/useOrganizations'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'

function toSlug(str) {
  return str.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

export default function NewOrganizationPage() {
  const router = useRouter()
  const { createOrganization } = useOrganizations()
  const [form, setForm] = useState({ name: '', slug: '', description: '' })
  const [slugEdited, setSlugEdited] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState('')

  const handleNameChange = (e) => {
    const name = e.target.value
    setForm(prev => ({
      ...prev,
      name,
      slug: slugEdited ? prev.slug : toSlug(name),
    }))
  }

  const handleSlugChange = (e) => {
    setSlugEdited(true)
    setForm(prev => ({ ...prev, slug: toSlug(e.target.value) }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.name.trim()) return setError('Organization name is required')
    if (!form.slug.trim()) return setError('Slug is required')

    setIsCreating(true)
    try {
      const org = await createOrganization(form)
      router.push(`/dashboard/organizations/${org.id}/members`)
    } catch (err) {
      setError(err.message)
      setIsCreating(false)
    }
  }

  return (
    <div>
      <div className="mb-8">
        <Link href="/dashboard/organizations" className="text-slate-600 hover:text-slate-900 mb-4 inline-block">
          ← Back to Organizations
        </Link>
        <h1 className="text-3xl font-bold text-slate-900">New Organization</h1>
        <p className="text-slate-600 mt-2">Create a workspace to collaborate with your team</p>
      </div>

      <Card className="p-8 max-w-lg">
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="name">Organization Name *</Label>
            <Input
              id="name"
              placeholder="e.g., Acme Corp"
              value={form.name}
              onChange={handleNameChange}
              disabled={isCreating}
              className="mt-2"
            />
          </div>

          <div>
            <Label htmlFor="slug">Slug *</Label>
            <div className="flex items-center gap-1 mt-2">
              <span className="text-slate-400 text-sm shrink-0">org/</span>
              <Input
                id="slug"
                placeholder="acme-corp"
                value={form.slug}
                onChange={handleSlugChange}
                disabled={isCreating}
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">Lowercase letters, numbers, and hyphens only</p>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              placeholder="What does your organization do?"
              value={form.description}
              onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
              disabled={isCreating}
              className="mt-2"
            />
          </div>

          <div className="flex gap-4 pt-2">
            <Link href="/dashboard/organizations" className="flex-1">
              <Button variant="outline" className="w-full" type="button">Cancel</Button>
            </Link>
            <Button type="submit" disabled={isCreating} className="flex-1">
              {isCreating ? 'Creating…' : 'Create Organization'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
