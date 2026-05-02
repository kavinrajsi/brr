'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { apiCall } from '@/lib/api-client'

export function useOrganizations() {
  const { user } = useAuth()
  const [organizations, setOrganizations] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchOrganizations = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await apiCall('/api/organizations')
      setOrganizations(res?.organizations ?? [])
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user) fetchOrganizations()
  }, [user, fetchOrganizations])

  const createOrganization = useCallback(async ({ name, slug, description }) => {
    const org = await apiCall('/api/organizations', {
      method: 'POST',
      body: JSON.stringify({ name, slug, description }),
    })
    setOrganizations(prev => [{ ...org, role: 'owner' }, ...prev])
    return org
  }, [])

  const deleteOrganization = useCallback(async (orgId) => {
    await apiCall(`/api/organizations/${orgId}`, { method: 'DELETE' })
    setOrganizations(prev => prev.filter(o => o.id !== orgId))
  }, [])

  return { organizations, isLoading, error, fetchOrganizations, createOrganization, deleteOrganization }
}
