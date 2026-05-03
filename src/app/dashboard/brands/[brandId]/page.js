'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { apiCall } from '@/lib/api-client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

const STATUS_STYLES = {
  Draft:    'bg-gray-100 text-gray-800',
  Config:   'bg-blue-100 text-blue-800',
  Training: 'bg-yellow-100 text-yellow-800',
  Deployed: 'bg-green-100 text-green-800',
}

export default function BrandDetailPage() {
  const { brandId } = useParams()
  const [brand, setBrand] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    apiCall(`/api/brands/${brandId}`)
      .then(setBrand)
      .catch(err => setError(err.message))
      .finally(() => setIsLoading(false))
  }, [brandId])

  if (isLoading) {
    return (
      <Card className="p-12 text-center">
        <p className="text-slate-600">Loading brand…</p>
      </Card>
    )
  }

  if (error || !brand) {
    return (
      <Card className="p-12 text-center bg-red-50 border-red-200">
        <p className="text-red-800 mb-4">{error ?? 'Brand not found'}</p>
        <Link href="/dashboard/brands">
          <Button variant="outline">Back to Brands</Button>
        </Link>
      </Card>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <Link href="/dashboard/brands" className="text-slate-600 hover:text-slate-900 mb-4 inline-block">
          ← Back to Brands
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{brand.name}</h1>
            {brand.short_name && <p className="text-slate-600 mt-1">{brand.short_name}</p>}
          </div>
          <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${STATUS_STYLES[brand.status] ?? STATUS_STYLES.Draft}`}>
            {brand.status}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="p-6">
          <p className="text-sm text-slate-600 font-medium">Current Stage</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">{brand.current_stage}</p>
          <p className="text-xs text-slate-500 mt-1">of 6 training stages</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-slate-600 font-medium">Created</p>
          <p className="text-lg font-semibold text-slate-900 mt-2">
            {new Date(brand.created_at).toLocaleDateString()}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Updated {new Date(brand.updated_at).toLocaleDateString()}
          </p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-slate-600 font-medium">Brand ID</p>
          <p className="text-xs font-mono text-slate-700 mt-2 break-all">{brand.id}</p>
        </Card>
      </div>

      <div className="mb-8">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Actions</h2>
        <div className="grid grid-cols-2 gap-4">
          {[
            { href: `/dashboard/brands/${brand.id}/config`, icon: '⚙️', label: 'Configure Brand', desc: 'Set tone, values, and brand identity' },
            { href: `/dashboard/brands/${brand.id}/knowledge`, icon: '📖', label: 'Knowledge Base', desc: 'Upload docs, FAQs, and product info' },
            { href: `/dashboard/brands/${brand.id}/scenarios`, icon: '📝', label: 'Test Scenarios', desc: 'Simulate customer conversations' },
            { href: `/dashboard/brands/${brand.id}/training`, icon: '📚', label: 'Training', desc: 'Run training stages for your agent' },
          ].map(({ href, icon, label, desc }) => (
            <Link key={label} href={href}>
              <Card className="p-5 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer h-full">
                <div className="flex items-start gap-3">
                  <span className="text-2xl leading-none mt-0.5">{icon}</span>
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">{label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {brand.notes && (
        <Card className="p-6 bg-blue-50 border-blue-200">
          <h3 className="font-bold text-blue-900">Notes</h3>
          <p className="text-blue-800 mt-2">{brand.notes}</p>
        </Card>
      )}
    </div>
  )
}
