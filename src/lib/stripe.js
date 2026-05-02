import Stripe from 'stripe'

// Gracefully handle missing keys so the app doesn't crash before keys are added
export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-04-30.basil' })
  : null

export const PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    interval: null,
    stripePriceId: null,
    limits: { brands: 3, agents: 5 },
    features: ['3 brands', '5 agents', 'Basic training', 'Email support'],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 29,
    interval: 'month',
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID ?? null,
    limits: { brands: 20, agents: 50 },
    features: ['20 brands', '50 agents', 'Advanced training', 'Priority support', 'Team collaboration'],
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    price: 99,
    interval: 'month',
    stripePriceId: process.env.STRIPE_ENTERPRISE_PRICE_ID ?? null,
    limits: { brands: Infinity, agents: Infinity },
    features: ['Unlimited brands', 'Unlimited agents', 'Custom training', 'Dedicated support', 'Advanced analytics', 'API access'],
  },
}

export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY)
}

// Returns the plan limits for a user based on their active subscription.
// Falls back to the Free plan if no subscription row exists.
export async function getUserPlanLimits(userId, supabase) {
  const { data } = await supabase
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', userId)
    .single()

  const activePlan = data?.status === 'active' ? (data.plan ?? 'free') : 'free'
  return PLANS[activePlan]?.limits ?? PLANS.free.limits
}
