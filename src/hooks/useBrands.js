'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiCall } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'

export function useBrands() {
  const { user } = useAuth()
  const [brands, setBrands] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchBrands = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await apiCall('/api/brands')
      // API returns { data, pagination } after Phase 3 — extract the array
      setBrands(res?.data ?? res ?? [])
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user) fetchBrands()
  }, [user, fetchBrands])

  // TODO: implement createBrand
  // Option A (optimistic): prepend newBrand to local state, no re-fetch
  // Option B (accurate):   call fetchBrands() after the API call
  const createBrand = useCallback(async (brandData) => {
    const newBrand = await apiCall('/api/brands', {
      method: 'POST',
      body: JSON.stringify(brandData),
    })
    setBrands(prev => [newBrand, ...prev])   // ← swap for fetchBrands() for Option B
    return newBrand
  }, [])

  // TODO: implement deleteBrand
  const deleteBrand = useCallback(async (brandId) => {
    await apiCall(`/api/brands/${brandId}`, { method: 'DELETE' })
    setBrands(prev => prev.filter(b => b.id !== brandId))   // ← swap for fetchBrands() for Option B
  }, [])

  return { brands, isLoading, error, fetchBrands, createBrand, deleteBrand }
}
