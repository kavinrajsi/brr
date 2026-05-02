'use client'

import { supabase } from './supabase'

async function getAuthToken() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token
}

export async function apiCall(endpoint, options = {}) {
  const token = await getAuthToken()

  const response = await fetch(endpoint, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error || `Request failed: ${response.status}`)
  }

  if (response.status === 204) return null
  return response.json()
}
