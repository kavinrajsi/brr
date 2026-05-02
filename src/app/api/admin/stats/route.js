import { getUserFromRequest, getAdminClient } from '@/lib/supabase-server'

export async function GET(req) {
  const user = await getUserFromRequest(req)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getAdminClient()

  // Resolve brand IDs first — .in() requires a plain array, not a subquery
  const { data: brandRows } = await supabase
    .from('brands')
    .select('id')
    .eq('user_id', user.id)

  const brandIds = (brandRows ?? []).map(b => b.id)

  const [
    { count: totalBrands },
    { count: totalAgents },
    { count: inTraining },
    { count: certified },
    { count: totalOrgs },
    { count: totalScenarios },
  ] = await Promise.all([
    supabase.from('brands').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    brandIds.length
      ? supabase.from('agents').select('*', { count: 'exact', head: true }).in('brand_id', brandIds)
      : Promise.resolve({ count: 0 }),
    brandIds.length
      ? supabase.from('agents').select('*', { count: 'exact', head: true }).eq('status', 'Training').in('brand_id', brandIds)
      : Promise.resolve({ count: 0 }),
    brandIds.length
      ? supabase.from('agents').select('*', { count: 'exact', head: true }).eq('status', 'Certified').in('brand_id', brandIds)
      : Promise.resolve({ count: 0 }),
    supabase.from('organization_members').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    brandIds.length
      ? supabase.from('test_scenarios').select('*', { count: 'exact', head: true }).in('brand_id', brandIds)
      : Promise.resolve({ count: 0 }),
  ])

  const { data: recentBrands } = await supabase
    .from('brands')
    .select('id, name, status, current_stage, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5)

  return Response.json({
    stats: {
      totalBrands: totalBrands ?? 0,
      totalAgents: totalAgents ?? 0,
      inTraining: inTraining ?? 0,
      certified: certified ?? 0,
      totalOrgs: totalOrgs ?? 0,
      totalScenarios: totalScenarios ?? 0,
    },
    recentBrands: recentBrands ?? [],
  })
}
