import { getUserFromRequest, getAdminClient } from '@/lib/supabase-server'
import { stripe, isStripeConfigured } from '@/lib/stripe'

export async function POST(req) {
  if (!isStripeConfigured()) {
    return Response.json({ error: 'Billing is not configured' }, { status: 503 })
  }

  const user = await getUserFromRequest(req)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getAdminClient()
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .single()

  if (!subscription?.stripe_customer_id) {
    return Response.json({ error: 'No billing account found' }, { status: 404 })
  }

  const origin = req.headers.get('origin') ?? 'http://localhost:3000'

  const session = await stripe.billingPortal.sessions.create({
    customer: subscription.stripe_customer_id,
    return_url: `${origin}/dashboard/billing`,
  })

  return Response.json({ url: session.url })
}
