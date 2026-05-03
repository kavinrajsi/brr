'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { apiCall } from '@/lib/api-client'

export function useAgents(brandId = null) {
  const { user } = useAuth()
  const [agents, setAgents] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchAgents = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await apiCall('/api/agents')
      const filtered = brandId ? data.filter(a => a.brand_id === brandId) : data
      setAgents(filtered ?? [])
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [brandId])

  useEffect(() => {
    if (user) fetchAgents()
  }, [user, fetchAgents])

  const createAgent = useCallback(async ({ brand_id, name }) => {
    const agent = await apiCall('/api/agents', {
      method: 'POST',
      body: JSON.stringify({ brand_id, name }),
    })
    setAgents(prev => [agent, ...prev])
    return agent
  }, [])

  const deleteAgent = useCallback(async (agentId) => {
    await apiCall(`/api/agents/${agentId}`, { method: 'DELETE' })
    setAgents(prev => prev.filter(a => a.id !== agentId))
  }, [])

  const updateAgent = useCallback(async (agentId, updates) => {
    const updated = await apiCall(`/api/agents/${agentId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
    setAgents(prev => prev.map(a => a.id === agentId ? { ...a, ...updated } : a))
    return updated
  }, [])

  return { agents, isLoading, error, fetchAgents, createAgent, updateAgent, deleteAgent }
}
