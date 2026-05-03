import { getUserFromRequest, getAdminClient, isPlatformAdmin } from '@/lib/supabase-server'
import { PLANS } from '@/lib/stripe'

export async function GET(req) {
  const user = await getUserFromRequest(req)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isPlatformAdmin(user)) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = getAdminClient()

  const [{ data: { users } = {}, error: authErr }, { data: subscriptions }] = await Promise.all([
    supabase.auth.admin.listUsers({ perPage: 1000 }),
    supabase.from('subscriptions').select('user_id, plan, status, current_period_end, updated_at, stripe_customer_id'),
  ])

  if (authErr) return Response.json({ error: authErr.message }, { status: 500 })

  const subsByUserId = Object.fromEntries((subscriptions ?? []).map(s => [s.user_id, s]))

  const rows = (users ?? []).map(u => {
    const sub = subsByUserId[u.id]
    const planId = sub?.status === 'active' ? (sub.plan ?? 'free') : 'free'
    const plan = PLANS[planId] ?? PLANS.free
    return {
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      plan: plan.name,
      plan_price: plan.price,
      subscription_status: sub?.status ?? 'free',
      current_period_end: sub?.current_period_end ?? null,
      stripe_customer_id: sub?.stripe_customer_id ?? null,
    }
  })

  rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  return Response.json({ users: rows })
}
