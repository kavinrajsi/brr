'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiCall, isAbortError } from '@/lib/api-client'

export function useBrandConfig(brandId) {
  const [config, setConfig] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  const fetchConfig = useCallback(async (signal) => {
    if (!brandId) return
    setIsLoading(true)
    setError(null)
    try {
      const data = await apiCall(`/api/brands/${brandId}/config`, { signal })
      setConfig(data.config ?? {})
    } catch (err) {
      if (!isAbortError(err)) setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [brandId])

  useEffect(() => {
    const controller = new AbortController()
    fetchConfig(controller.signal)
    return () => controller.abort()
  }, [fetchConfig])

  const saveConfig = useCallback(async (configData) => {
    setIsSaving(true)
    setError(null)
    try {
      const data = await apiCall(`/api/brands/${brandId}/config`, {
        method: 'PUT',
        body: JSON.stringify({ config: configData }),
      })
      setConfig(data.config)
      return data
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setIsSaving(false)
    }
  }, [brandId])

  return { config, isLoading, error, isSaving, saveConfig }
}
