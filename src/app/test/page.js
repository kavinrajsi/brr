'use client'

import { useEffect, useState } from 'react'
import { notFound } from 'next/navigation'
import { testSupabaseConnection } from '@/lib/test-supabase'

// Debug-only page. In production this returns 404 so a publicly-reachable
// /test route doesn't expose Supabase connection state to anyone who guesses
// the URL. Next inlines NODE_ENV at build time so the guard is removed by
// the optimiser in dev builds.
const IS_PRODUCTION = process.env.NODE_ENV === 'production'

export default function TestPage() {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (IS_PRODUCTION) return
    let cancelled = false
    async function test() {
      const r = await testSupabaseConnection()
      if (!cancelled) {
        setResult(r)
        setLoading(false)
      }
    }
    test()
    return () => { cancelled = true }
  }, [])

  if (IS_PRODUCTION) notFound()

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Supabase Connection Test (dev only)</h1>
      {loading ? (
        <p>Testing...</p>
      ) : result?.success ? (
        <div style={{ color: 'green', padding: '1rem', backgroundColor: '#f0f0f0' }}>
          ✅ {result.message}
        </div>
      ) : (
        <div style={{ color: 'red', padding: '1rem', backgroundColor: '#f0f0f0' }}>
          ❌ Error: {result?.error}
        </div>
      )}
    </div>
  )
}
