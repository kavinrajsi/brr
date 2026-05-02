import { getUserFromRequest } from '@/lib/supabase-server'
import { stripe, PLANS, isStripeConfigured } from '@/lib/stripe'

export async function POST(req) {
  if (!isStripeConfigured()) {
    return Response.json({ error: 'Billing is not configured' }, { status: 503 })
  }

  const user = await getUserFromRequest(req)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { planId } = await req.json()
  const plan = PLANS[planId]

  if (!plan || plan.id === 'free') {
    return Response.json({ error: 'Invalid plan' }, { status: 400 })
  }
  if (!plan.stripePriceId) {
    return Response.json({ error: 'Plan price not configured' }, { status: 503 })
  }

  const origin = req.headers.get('origin') ?? 'http://localhost:3000'

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer_email: user.email,
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    metadata: { userId: user.id, planId },
    success_url: `${origin}/dashboard/billing?success=1`,
    cancel_url: `${origin}/dashboard/billing?cancelled=1`,
  })

  return Response.json({ url: session.url })
}
