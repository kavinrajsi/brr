'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useAgents } from '@/hooks/useAgents'
import { apiCall } from '@/lib/api-client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function BrandTrainingPage() {
  const { brandId } = useParams()
  const { agents, isLoading, createAgent } = useAgents(brandId)
  const [brand, setBrand] = useState(null)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    apiCall(`/api/brands/${brandId}`).then(setBrand).catch(() => {})
  }, [brandId])

  const handleCreateAgent = async () => {
    if (!brand) return
    setIsCreating(true)
    setError('')
    try {
      await createAgent({ brand_id: brandId, name: `${brand.name} Agent` })
    } catch (err) {
      setError(err.message)
    } finally {
      setIsCreating(false)
    }
  }

  const STATUS_STYLES = {
    Training:  'bg-blue-100 text-blue-800',
    Certified: 'bg-green-100 text-green-800',
    Deployed:  'bg-purple-100 text-purple-800',
  }

  return (
    <div>
      <div className="mb-8">
        <Link href={`/dashboard/brands/${brandId}`} className="text-slate-600 hover:text-slate-900 mb-4 inline-block">
          ← Back to Brand
        </Link>
        <h1 className="text-3xl font-bold text-slate-900">Training</h1>
        {brand && <p className="text-slate-600 mt-1">{brand.name}</p>}
      </div>

      {error && (
        <Card className="p-4 mb-6 bg-red-50 border-red-200">
          <p className="text-red-800">{error}</p>
        </Card>
      )}

      {isLoading && (
        <Card className="p-12 text-center"><p className="text-slate-600">Loading…</p></Card>
      )}

      {!isLoading && agents.length === 0 && (
        <Card className="p-12 text-center bg-slate-50">
          <p className="text-slate-900 font-semibold mb-2">No agent started yet</p>
          <p className="text-sm text-slate-500 mb-6">
            Create an agent to begin the 6-stage training program
          </p>
          <Button onClick={handleCreateAgent} disabled={isCreating}>
            {isCreating ? 'Creating…' : 'Start Training'}
          </Button>
        </Card>
      )}

      {!isLoading && agents.length > 0 && (
        <div className="space-y-4">
          {agents.map(agent => (
            <Card key={agent.id} className="p-6 flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-900">{agent.name}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[agent.status] ?? STATUS_STYLES.Training}`}>
                    {agent.status}
                  </span>
                  <span className="text-xs text-slate-500">Stage {agent.current_stage}/6</span>
                </div>
              </div>
              <Link href={`/dashboard/brands/${brandId}/agents/${agent.id}`}>
                <Button>Continue Training</Button>
              </Link>
            </Card>
          ))}

          <div className="text-center pt-4">
            <Button variant="outline" onClick={handleCreateAgent} disabled={isCreating}>
              {isCreating ? 'Creating…' : '+ Add Another Agent'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
