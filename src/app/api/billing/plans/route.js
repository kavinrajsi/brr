import { getUserFromRequest, getAdminClient } from '@/lib/supabase-server'
import { PLANS, isStripeConfigured } from '@/lib/stripe'

export async function GET(req) {
  const user = await getUserFromRequest(req)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getAdminClient()
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan, status, current_period_end')
    .eq('user_id', user.id)
    .single()

  const currentPlan = subscription?.plan ?? 'free'

  return Response.json({
    plans: Object.values(PLANS),
    currentPlan,
    subscription: subscription ?? { plan: 'free', status: 'active' },
    stripeConfigured: isStripeConfigured(),
  })
}
