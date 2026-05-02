'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useBilling } from '@/hooks/useBilling'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

const PLAN_STYLES = {
  free:       { ring: 'ring-slate-200',  badge: 'bg-slate-100 text-slate-700' },
  pro:        { ring: 'ring-blue-400',   badge: 'bg-blue-600 text-white' },
  enterprise: { ring: 'ring-amber-400',  badge: 'bg-amber-500 text-white' },
}

export default function BillingPage() {
  const searchParams = useSearchParams()
  const { plans, currentPlan, subscription, stripeConfigured, isLoading, error, startCheckout, openPortal } = useBilling()
  const [upgrading, setUpgrading] = useState(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const [actionError, setActionError] = useState('')

  const success = searchParams.get('success')
  const cancelled = searchParams.get('cancelled')

  const handleUpgrade = async (planId) => {
    setActionError('')
    setUpgrading(planId)
    try {
      await startCheckout(planId)
    } catch (err) {
      setActionError(err.message)
      setUpgrading(null)
    }
  }

  const handlePortal = async () => {
    setActionError('')
    setPortalLoading(true)
    try {
      await openPortal()
    } catch (err) {
      setActionError(err.message)
      setPortalLoading(false)
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Billing</h1>
        <p className="text-slate-600 mt-2">Manage your subscription and plan</p>
      </div>

      {success && (
        <Alert className="mb-6 bg-green-50 border-green-200">
          <AlertDescription className="text-green-800">
            Subscription activated successfully! Your plan has been upgraded.
          </AlertDescription>
        </Alert>
      )}

      {cancelled && (
        <Alert className="mb-6 bg-yellow-50 border-yellow-200">
          <AlertDescription className="text-yellow-800">Checkout cancelled. Your plan was not changed.</AlertDescription>
        </Alert>
      )}

      {(error || actionError) && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error || actionError}</AlertDescription>
        </Alert>
      )}

      {!stripeConfigured && (
        <Alert className="mb-6 bg-blue-50 border-blue-200">
          <AlertDescription className="text-blue-800">
            Stripe is not configured. Add <code className="font-mono text-xs bg-blue-100 px-1 py-0.5 rounded">STRIPE_SECRET_KEY</code>, <code className="font-mono text-xs bg-blue-100 px-1 py-0.5 rounded">STRIPE_PRO_PRICE_ID</code>, and <code className="font-mono text-xs bg-blue-100 px-1 py-0.5 rounded">STRIPE_ENTERPRISE_PRICE_ID</code> to <code className="font-mono text-xs bg-blue-100 px-1 py-0.5 rounded">.env.local</code> to enable payments.
          </AlertDescription>
        </Alert>
      )}

      {/* Current plan summary */}
      {subscription && (
        <Card className="p-6 mb-8 bg-slate-50 max-w-md">
          <p className="text-sm text-slate-600 font-medium mb-1">Current Plan</p>
          <p className="text-2xl font-bold text-slate-900 capitalize">{currentPlan}</p>
          {subscription.current_period_end && (
            <p className="text-sm text-slate-500 mt-1">
              Renews {new Date(subscription.current_period_end).toLocaleDateString()}
            </p>
          )}
          {currentPlan !== 'free' && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={handlePortal}
              disabled={portalLoading || !stripeConfigured}
            >
              {portalLoading ? 'Opening…' : 'Manage Subscription'}
            </Button>
          )}
        </Card>
      )}

      {/* Plan cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <Card key={i} className="p-6 animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-1/2 mb-4" />
              <div className="h-8 bg-gray-200 rounded w-1/3 mb-6" />
              <div className="space-y-2">
                {[1,2,3,4].map(j => <div key={j} className="h-4 bg-gray-200 rounded" />)}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map(plan => {
            const isCurrent = plan.id === currentPlan
            const styles = PLAN_STYLES[plan.id] ?? PLAN_STYLES.free

            return (
              <Card
                key={plan.id}
                className={`p-6 ${isCurrent ? `ring-2 ${styles.ring}` : ''}`}
              >
                {isCurrent && (
                  <span className={`inline-block mb-3 px-3 py-0.5 rounded-full text-xs font-semibold ${styles.badge}`}>
                    Current Plan
                  </span>
                )}

                <h3 className="text-lg font-bold text-slate-900">{plan.name}</h3>
                <div className="mt-2 mb-6">
                  {plan.price === 0 ? (
                    <span className="text-3xl font-bold text-slate-900">Free</span>
                  ) : (
                    <>
                      <span className="text-3xl font-bold text-slate-900">${plan.price}</span>
                      <span className="text-slate-500 text-sm"> / month</span>
                    </>
                  )}
                </div>

                <ul className="space-y-2 mb-6">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-slate-700">
                      <span className="text-green-500 font-bold">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <Button variant="outline" className="w-full" disabled>Current Plan</Button>
                ) : plan.price === 0 ? (
                  <Button variant="outline" className="w-full" disabled>Downgrade</Button>
                ) : (
                  <Button
                    className="w-full"
                    onClick={() => handleUpgrade(plan.id)}
                    disabled={upgrading === plan.id || !stripeConfigured}
                  >
                    {upgrading === plan.id ? 'Redirecting…' : `Upgrade to ${plan.name}`}
                  </Button>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
