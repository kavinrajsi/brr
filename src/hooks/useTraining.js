'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiCall, isAbortError } from '@/lib/api-client'

export function useTraining(agentId) {
  const [stages, setStages] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  const fetchTraining = useCallback(async (signal) => {
    if (!agentId) return
    setIsLoading(true)
    setError(null)
    try {
      const data = await apiCall(`/api/agents/${agentId}/training`, { signal })
      setStages(data ?? [])
    } catch (err) {
      if (!isAbortError(err)) setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [agentId])

  useEffect(() => {
    const controller = new AbortController()
    fetchTraining(controller.signal)
    return () => controller.abort()
  }, [fetchTraining])

  const saveStage = useCallback(async (stageNum, updates) => {
    setIsSaving(true)
    try {
      await apiCall(`/api/agents/${agentId}/training/${stageNum}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      })
      // Refetch only — cascades (agent.current_stage, next stage unlocked,
      // certified_at) require fresh DB state. Previously this also did an
      // optimistic local-state patch; that's redundant now and led to a
      // brief flash of half-updated UI.
      await fetchTraining()
    } finally {
      setIsSaving(false)
    }
  }, [agentId, fetchTraining])

  const getStage = useCallback((num) => stages.find(s => s.stage === num), [stages])

  return { stages, isLoading, error, isSaving, saveStage, getStage, refetch: fetchTraining }
}
