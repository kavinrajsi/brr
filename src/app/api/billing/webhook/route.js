import { stripe } from '@/lib/stripe'
import { getAdminClient } from '@/lib/supabase-server'

// Stripe sends raw body — Next.js must not parse it
export const runtime = 'nodejs'

// Convert a Stripe Unix timestamp (seconds) to ISO. Trialing / incomplete
// subscription events arrive without a current_period_end, so we cannot
// blindly multiply by 1000 — that produces NaN → invalid Date → throw → 500.
function toIsoOrNull(unixSeconds) {
  if (typeof unixSeconds !== 'number' || !Number.isFinite(unixSeconds)) return null
  return new Date(unixSeconds * 1000).toISOString()
}

// Try to claim the event for processing. Returns true if this is the first
// time we're seeing it; false if Stripe is retrying a previously-processed
// event (idempotent short-circuit).
async function claimEvent(supabase, event) {
  const { error } = await supabase
    .from('stripe_events')
    .insert({ id: event.id, type: event.type })

  if (!error) return true
  // 23505 = unique_violation in Postgres; means we've already processed it
  if (error.code === '23505') return false
  // Anything else is a real DB problem — bubble it up so Stripe retries
  throw error
}

export async function POST(req) {
  if (!stripe) return new Response('Billing not configured', { status: 503 })

  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  let event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    // The signature error message is from the SDK and is not sensitive
    return new Response(`Webhook error: ${err.message}`, { status: 400 })
  }

  const supabase = getAdminClient()

  // Idempotency gate. Stripe retries any non-2xx response and may also send
  // duplicate deliveries during reconnection. Without this gate, every
  // checkout.session.completed would re-upsert subscriptions on each retry.
  let claimed
  try {
    claimed = await claimEvent(supabase, event)
  } catch (err) {
    console.error('[webhook] claimEvent failed:', err?.message)
    return new Response('Database error', { status: 500 })
  }
  if (!claimed) {
    return new Response('OK (duplicate)', { status: 200 })
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object
      const { userId, planId } = session.metadata ?? {}
      if (!userId || !planId) return new Response('OK')

      // Defence in depth: never trust metadata blindly. Cross-check the
      // userId against the user record by email before granting the sub.
      const claimedEmail = session.customer_details?.email ?? session.customer_email
      if (claimedEmail) {
        const { data: { user: actualUser } = {} } = await supabase.auth.admin.getUserById(userId)
        if (!actualUser) {
          console.warn(JSON.stringify({
            level: 'warn', event: 'webhook_user_not_found', userId, claimedEmail, sessionId: session.id,
          }))
          return new Response('OK')
        }
        if (actualUser.email?.toLowerCase() !== claimedEmail.toLowerCase()) {
          console.warn(JSON.stringify({
            level: 'warn', event: 'webhook_email_mismatch',
            metadataUserId: userId, actualEmail: actualUser.email, claimedEmail, sessionId: session.id,
          }))
          return new Response('OK')
        }
      }

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
      // current_period_end is undefined on trialing / incomplete subs.
      // Build the update conditionally so we only set the timestamp when
      // Stripe actually sent one.
      const update = {
        status: sub.status,
        updated_at: new Date().toISOString(),
      }
      const periodEnd = toIsoOrNull(sub.current_period_end)
      if (periodEnd) update.current_period_end = periodEnd

      await supabase
        .from('subscriptions')
        .update(update)
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
  } catch (err) {
    // If processing failed AFTER we claimed the event, roll back the claim
    // so Stripe's retry can take another swing.
    console.error('[webhook] handler failed:', err?.message)
    await supabase.from('stripe_events').delete().eq('id', event.id)
    return new Response('Handler error', { status: 500 })
  }
}
