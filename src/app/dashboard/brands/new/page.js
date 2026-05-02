'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useBrands } from '@/hooks/useBrands'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import Link from 'next/link'

export default function NewBrandPage() {
  const router = useRouter()
  const { createBrand } = useBrands()
  const [formData, setFormData] = useState({ name: '', short_name: '' })
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!formData.name.trim()) {
      setError('Brand name is required')
      return
    }

    setIsCreating(true)
    try {
      const newBrand = await createBrand({
        name: formData.name.trim(),
        short_name: formData.short_name.trim(),
      })
      router.push(`/dashboard/brands/${newBrand.id}/config`)
    } catch (err) {
      setError(err.message)
      setIsCreating(false)
    }
  }

  return (
    <div>
      <div className="mb-8">
        <Link href="/dashboard/brands" className="text-slate-600 hover:text-slate-900 mb-4 inline-block">
          ← Back to Brands
        </Link>
        <h1 className="text-3xl font-bold text-slate-900">Create New Brand</h1>
        <p className="text-slate-600 mt-2">Add a brand to configure AI agents for</p>
      </div>

      <Card className="p-8 max-w-lg">
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="name">Brand Name *</Label>
            <Input
              id="name"
              placeholder="e.g., Nithya Amirtham"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              disabled={isCreating}
              className="mt-2"
            />
            <p className="text-xs text-slate-500 mt-1">The official name of your brand</p>
          </div>

          <div>
            <Label htmlFor="short_name">Short Name</Label>
            <Input
              id="short_name"
              placeholder="e.g., NA"
              value={formData.short_name}
              onChange={(e) => setFormData({ ...formData, short_name: e.target.value })}
              disabled={isCreating}
              className="mt-2"
            />
            <p className="text-xs text-slate-500 mt-1">Abbreviated version (optional)</p>
          </div>

          <div className="flex gap-4 pt-2">
            <Link href="/dashboard/brands" className="flex-1">
              <Button variant="outline" className="w-full" type="button">
                Cancel
              </Button>
            </Link>
            <Button type="submit" disabled={isCreating} className="flex-1">
              {isCreating ? 'Creating…' : 'Create Brand'}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="mt-8 p-6 bg-blue-50 border-blue-200 max-w-lg">
        <h3 className="font-bold text-blue-900 mb-3">What happens next?</h3>
        <ol className="space-y-1.5 text-blue-800 text-sm list-decimal list-inside">
          <li>Create your brand</li>
          <li>Configure its BRR (Brand Road Rules)</li>
          <li>Generate training materials</li>
          <li>Train your AI agent (8 weeks)</li>
          <li>Deploy to production</li>
        </ol>
      </Card>
    </div>
  )
}
