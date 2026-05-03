'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiCall, isAbortError } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'

export function useBrands() {
  const { user } = useAuth()
  const [brands, setBrands] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchBrands = useCallback(async (signal) => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await apiCall('/api/brands', { signal })
      // API returns { data, pagination } after Phase 3 — extract the array
      setBrands(res?.data ?? res ?? [])
    } catch (err) {
      if (!isAbortError(err)) setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!user) return
    const controller = new AbortController()
    fetchBrands(controller.signal)
    return () => controller.abort()
  }, [user, fetchBrands])

  const createBrand = useCallback(async (brandData) => {
    const newBrand = await apiCall('/api/brands', {
      method: 'POST',
      body: JSON.stringify(brandData),
    })
    setBrands(prev => [newBrand, ...prev])
    return newBrand
  }, [])

  const deleteBrand = useCallback(async (brandId) => {
    await apiCall(`/api/brands/${brandId}`, { method: 'DELETE' })
    setBrands(prev => prev.filter(b => b.id !== brandId))
  }, [])

  return { brands, isLoading, error, fetchBrands, createBrand, deleteBrand }
}
