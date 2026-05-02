'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import { useOrganizations } from '@/hooks/useOrganizations'

const OrganizationContext = createContext()

const STORAGE_KEY = 'brr_active_org'

export function OrganizationProvider({ children }) {
  const { organizations, isLoading, error, fetchOrganizations } = useOrganizations()
  const [activeOrg, setActiveOrg] = useState(null)

  // Restore last active org from localStorage, falling back to first org
  useEffect(() => {
    if (isLoading || organizations.length === 0) return

    const savedId = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
    const match = organizations.find(o => o.id === savedId) ?? organizations[0]
    setActiveOrg(match)
  }, [organizations, isLoading])

  const switchOrg = (org) => {
    setActiveOrg(org)
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, org.id)
  }

  return (
    <OrganizationContext.Provider value={{ organizations, activeOrg, isLoading, error, switchOrg, refetch: fetchOrganizations }}>
      {children}
    </OrganizationContext.Provider>
  )
}

export function useOrganization() {
  const ctx = useContext(OrganizationContext)
  if (!ctx) throw new Error('useOrganization must be used within OrganizationProvider')
  return ctx
}
