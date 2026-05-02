'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const { forgotPassword, isLoading } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!email) {
      setError('Email address is required')
      return
    }

    try {
      await forgotPassword(email)
      setSent(true)
    } catch (err) {
      setError(err.message || 'Failed to send reset email. Please try again.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 p-4">
      <div className="w-full max-w-md">
        <Card className="p-8 shadow-lg">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-slate-900">BRR AI</h1>
            <p className="text-slate-600 mt-2">Reset your password</p>
          </div>

          {sent ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">✉️</span>
              </div>
              <h2 className="text-lg font-semibold text-slate-900 mb-2">Check your email</h2>
              <p className="text-slate-600 text-sm mb-6">
                We sent a password reset link to <strong>{email}</strong>. Click the link in the email to set a new password.
              </p>
              <Link href="/auth/login" className="text-slate-900 font-semibold hover:underline text-sm">
                ← Back to sign in
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <Alert variant="destructive" className="mb-6">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="email" className="text-sm font-medium text-slate-700">
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    className="mt-1"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    We&apos;ll send a reset link to this address.
                  </p>
                </div>

                <Button type="submit" className="w-full mt-4" disabled={isLoading}>
                  {isLoading ? 'Sending…' : 'Send Reset Link'}
                </Button>
              </form>

              <p className="text-center text-sm text-slate-600 mt-6">
                <Link href="/auth/login" className="text-slate-900 font-semibold hover:underline">
                  ← Back to sign in
                </Link>
              </p>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
