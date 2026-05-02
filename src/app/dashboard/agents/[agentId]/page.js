'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { apiCall } from '@/lib/api-client'
import { Card } from '@/components/ui/card'

// Fetch the agent to get its brand_id, then redirect to the brand-scoped training page
export default function AgentRedirectPage() {
  const { agentId } = useParams()
  const router = useRouter()

  useEffect(() => {
    apiCall(`/api/agents/${agentId}`)
      .then(agent => {
        router.replace(`/dashboard/brands/${agent.brand_id}/agents/${agentId}`)
      })
      .catch(() => {
        router.replace('/dashboard/agents')
      })
  }, [agentId, router])

  return (
    <Card className="p-12 text-center">
      <p className="text-slate-600">Loading agent…</p>
    </Card>
  )
}
