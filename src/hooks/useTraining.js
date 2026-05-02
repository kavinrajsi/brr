'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiCall } from '@/lib/api-client'

export function useTraining(agentId) {
  const [stages, setStages] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  const fetchTraining = useCallback(async () => {
    if (!agentId) return
    setIsLoading(true)
    setError(null)
    try {
      const data = await apiCall(`/api/agents/${agentId}/training`)
      setStages(data ?? [])
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [agentId])

  useEffect(() => {
    fetchTraining()
  }, [fetchTraining])

  const saveStage = useCallback(async (stageNum, updates) => {
    setIsSaving(true)
    try {
      const data = await apiCall(`/api/agents/${agentId}/training/${stageNum}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      })
      setStages(prev => prev.map(s => s.stage === stageNum ? data : s))
      // Re-fetch to pick up any cascade changes (agent current_stage, next stage unlocked)
      await fetchTraining()
      return data
    } finally {
      setIsSaving(false)
    }
  }, [agentId, fetchTraining])

  const getStage = useCallback((num) => stages.find(s => s.stage === num), [stages])

  return { stages, isLoading, error, isSaving, saveStage, getStage, refetch: fetchTraining }
}
