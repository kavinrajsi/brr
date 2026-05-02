'use client'

import { useEffect, useState } from 'react'
import { testSupabaseConnection } from '@/lib/test-supabase'

export default function TestPage() {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function test() {
      const result = await testSupabaseConnection()
      setResult(result)
      setLoading(false)
    }
    test()
  }, [])

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Supabase Connection Test</h1>
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
