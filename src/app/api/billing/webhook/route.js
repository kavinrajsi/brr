import { stripe } from '@/lib/stripe'
import { getAdminClient } from '@/lib/supabase-server'

// Stripe sends raw body — Next.js must not parse it
export const runtime = 'nodejs'

export async function POST(req) {
  if (!stripe) return new Response('Billing not configured', { status: 503 })

  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  let event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    return new Response(`Webhook error: ${err.message}`, { status: 400 })
  }

  const supabase = getAdminClient()

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const { userId, planId } = session.metadata ?? {}
    if (!userId || !planId) return new Response('OK')

    await supabase.from('subscriptions').upsert([{
      user_id: userId,
      plan: planId,
      status: 'active',
      stripe_customer_id: session.customer,
      stripe_subscription_id: session.subscription,
      updated_at: new Date().toISOString(),
    }], { onConflict: 'user_id' })
  }

  if (event.type === 'customer.subscription.updated') {
    const sub = event.data.object
    await supabase
      .from('subscriptions')
      .update({
        status: sub.status,
        current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_subscription_id', sub.id)
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object
    await supabase
      .from('subscriptions')
      .update({ plan: 'free', status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('stripe_subscription_id', sub.id)
  }

  return new Response('OK')
}
