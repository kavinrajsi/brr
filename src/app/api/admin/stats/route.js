import { getUserFromRequest, getAdminClient, isPlatformAdmin } from '@/lib/supabase-server'

// Platform-wide stats — visible only to ADMIN_USER_IDS allowlist.
// For per-user dashboard stats, see /api/dashboard/stats.
export async function GET(req) {
  const user = await getUserFromRequest(req)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isPlatformAdmin(user)) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = getAdminClient()

  const [
    { count: totalUsers },
    { count: totalBrands },
    { count: totalAgents },
    { count: inTraining },
    { count: certified },
    { count: deployed },
    { count: totalOrgs },
    { count: totalScenarios },
    { count: totalConversations },
    { data: { users } = {} },
  ] = await Promise.all([
    supabase.from('subscriptions').select('*', { count: 'estimated', head: true }),
    supabase.from('brands').select('*', { count: 'estimated', head: true }),
    supabase.from('agents').select('*', { count: 'estimated', head: true }),
    supabase.from('agents').select('*', { count: 'estimated', head: true }).eq('status', 'Training'),
    supabase.from('agents').select('*', { count: 'estimated', head: true }).eq('status', 'Certified'),
    supabase.from('agents').select('*', { count: 'estimated', head: true }).eq('status', 'Deployed'),
    supabase.from('organizations').select('*', { count: 'estimated', head: true }),
    supabase.from('test_scenarios').select('*', { count: 'estimated', head: true }),
    supabase.from('agent_conversations').select('*', { count: 'estimated', head: true }),
    supabase.auth.admin.listUsers({ perPage: 1 }), // for total users count via metadata
  ])

  return Response.json({
    stats: {
      totalUsers: users?.length ?? totalUsers ?? 0,
      totalBrands: totalBrands ?? 0,
      totalAgents: totalAgents ?? 0,
      inTraining: inTraining ?? 0,
      certified: certified ?? 0,
      deployed: deployed ?? 0,
      totalOrgs: totalOrgs ?? 0,
      totalScenarios: totalScenarios ?? 0,
      totalConversations: totalConversations ?? 0,
    },
  })
}
