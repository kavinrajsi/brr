'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

export default function Home() {
  const router = useRouter()
  const { user, isLoading } = useAuth()

  useEffect(() => {
    if (!isLoading) {
      router.push(user ? '/dashboard' : '/auth/login')
    }
  }, [user, isLoading, router])

  return <div>Loading...</div>
}