'use client'

import { useState } from 'react'
import { useBrands } from '@/hooks/useBrands'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

const STATUS_STYLES = {
  Draft:    'bg-gray-100 text-gray-800',
  Config:   'bg-blue-100 text-blue-800',
  Training: 'bg-yellow-100 text-yellow-800',
  Deployed: 'bg-green-100 text-green-800',
}

export default function BrandsPage() {
  const { brands, isLoading, error, deleteBrand } = useBrands()
  const [deleting, setDeleting] = useState(null)

  const handleDelete = async (brandId) => {
    if (!window.confirm('Delete this brand? This cannot be undone.')) return
    setDeleting(brandId)
    try {
      await deleteBrand(brandId)
    } catch (err) {
      alert('Failed to delete brand: ' + err.message)
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Brands</h1>
          <p className="text-slate-600 mt-2">Configure AI agents for your brands</p>
        </div>
        <Link href="/dashboard/brands/new">
          <Button>+ Create Brand</Button>
        </Link>
      </div>

      {error && (
        <Card className="p-4 mb-6 bg-red-50 border-red-200">
          <p className="text-red-800">Error: {error}</p>
        </Card>
      )}

      {isLoading && (
        <Card className="p-12 text-center">
          <p className="text-slate-600">Loading brands...</p>
        </Card>
      )}

      {!isLoading && brands.length === 0 && (
        <Card className="p-12 text-center bg-slate-50">
          <p className="text-slate-600 mb-6">No brands yet. Create your first brand!</p>
          <Link href="/dashboard/brands/new">
            <Button>Create Your First Brand</Button>
          </Link>
        </Card>
      )}

      {!isLoading && brands.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Brand Name', 'Status', 'Stage', 'Created', ''].map(h => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider last:text-right">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {brands.map(brand => (
                <tr key={brand.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <p className="font-medium text-slate-900">{brand.name}</p>
                    <p className="text-sm text-slate-500">{brand.short_name}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[brand.status] ?? STATUS_STYLES.Draft}`}>
                      {brand.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-900">
                    {brand.current_stage}/6
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">
                    {new Date(brand.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/dashboard/brands/${brand.id}`}>
                        <Button variant="outline" size="icon-sm" title="View Brand">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
                        </Button>
                      </Link>
                      <Button
                        variant="destructive"
                        size="icon-sm"
                        title="Delete Brand"
                        onClick={() => handleDelete(brand.id)}
                        disabled={deleting === brand.id}
                      >
                        {deleting === brand.id
                          ? <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                          : <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                        }
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
