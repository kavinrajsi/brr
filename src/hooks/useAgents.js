'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { apiCall, isAbortError } from '@/lib/api-client'

// Pass `brandId` to filter on the server. Previously this hook fetched ALL
// agents the user owned and filtered client-side — wasteful and racy when
// switching brands.
export function useAgents(brandId = null) {
  const { user } = useAuth()
  const [agents, setAgents] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchAgents = useCallback(async (signal) => {
    setIsLoading(true)
    setError(null)
    try {
      const url = brandId
        ? `/api/agents?brand_id=${encodeURIComponent(brandId)}`
        : '/api/agents'
      const data = await apiCall(url, { signal })
      setAgents(Array.isArray(data) ? data : [])
    } catch (err) {
      if (!isAbortError(err)) setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [brandId])

  // Abort the in-flight fetch on unmount or when dependencies change so a
  // late response from a previous brandId can't overwrite fresh state.
  useEffect(() => {
    if (!user) return
    const controller = new AbortController()
    fetchAgents(controller.signal)
    return () => controller.abort()
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
