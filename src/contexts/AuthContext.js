'use client'

import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  // Separate state for in-flight credential operations (login/signup/reset/etc).
  // Previously consumers used isLoading for both — that flips false after the
  // initial session check, which let users double-click submit before the
  // network call returned.
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    const checkUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!cancelled) setUser(session?.user || null)
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    checkUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!cancelled) setUser(session?.user || null)
      }
    )

    return () => {
      cancelled = true
      subscription?.unsubscribe()
    }
  }, [])

  // Each credential op sets isSubmitting around itself. Inlined (rather than
  // wrapped via a higher-order helper) so ESLint's exhaustive-deps can verify
  // the dependency lists statically — wrapping confused the rule.

  const signup = useCallback(async (email, password) => {
    setIsSubmitting(true)
    setError(null)
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      })
      if (error) throw error
      return data
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setIsSubmitting(false)
    }
  }, [])

  const login = useCallback(async (email, password) => {
    setIsSubmitting(true)
    setError(null)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      return data
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setIsSubmitting(false)
    }
  }, [])

  const forgotPassword = useCallback(async (email) => {
    setIsSubmitting(true)
    setError(null)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })
      if (error) throw error
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setIsSubmitting(false)
    }
  }, [])

  const updatePassword = useCallback(async (newPassword) => {
    setIsSubmitting(true)
    setError(null)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setIsSubmitting(false)
    }
  }, [])

  const logout = useCallback(async () => {
    setIsSubmitting(true)
    setError(null)
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      setUser(null)
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setIsSubmitting(false)
    }
  }, [])

  // Memoise the context value so consumers don't re-render every time a
  // parent re-renders. Was creating a fresh object literal each render.
  const value = useMemo(
    () => ({ user, isLoading, isSubmitting, error, signup, login, logout, forgotPassword, updatePassword }),
    [user, isLoading, isSubmitting, error, signup, login, logout, forgotPassword, updatePassword]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
