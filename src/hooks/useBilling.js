'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { apiCall } from '@/lib/api-client'

export function useBilling() {
  const { user } = useAuth()
  const [plans, setPlans] = useState([])
  const [currentPlan, setCurrentPlan] = useState('free')
  const [subscription, setSubscription] = useState(null)
  const [stripeConfigured, setStripeConfigured] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchPlans = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await apiCall('/api/billing/plans')
      setPlans(res.plans)
      setCurrentPlan(res.currentPlan)
      setSubscription(res.subscription)
      setStripeConfigured(res.stripeConfigured)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user) fetchPlans()
  }, [user, fetchPlans])

  const startCheckout = useCallback(async (planId) => {
    const { url } = await apiCall('/api/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ planId }),
    })
    window.location.href = url
  }, [])

  const openPortal = useCallback(async () => {
    const { url } = await apiCall('/api/billing/portal', { method: 'POST' })
    window.location.href = url
  }, [])

  return { plans, currentPlan, subscription, stripeConfigured, isLoading, error, startCheckout, openPortal }
}
