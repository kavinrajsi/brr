'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export function useSupabaseAuth() {
  const { user } = useAuth()
  const [token, setToken] = useState(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    if (!user) {
      setToken(null)
      setIsReady(true)
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      setToken(data.session?.access_token ?? null)
      setIsReady(true)
    })
  }, [user])

  return { token, isReady }
}
