import { getAdminClient } from './supabase-server'

export async function getBrandsPaginated(userId, page = 1, limit = 20) {
  const supabase = getAdminClient()
  const offset = (page - 1) * limit

  const { data, count, error } = await supabase
    .from('brands')
    .select('id, name, short_name, status, current_stage, created_at', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw error
  return {
    data,
    pagination: { total: count, page, limit, pages: Math.ceil(count / limit) },
  }
}

export async function getBrandWithConfig(brandId, userId) {
  const supabase = getAdminClient()

  const [brandRes, configRes] = await Promise.all([
    supabase.from('brands').select('*').eq('id', brandId).eq('user_id', userId).single(),
    supabase.from('brand_configs').select('*').eq('brand_id', brandId).maybeSingle(),
  ])

  if (brandRes.error) throw brandRes.error
  return { brand: brandRes.data, config: configRes.data }
}

// Require userId so callers can't accidentally hand out cross-tenant agents.
// The brands!inner join short-circuits the query if the brand isn't owned
// by this user (returns []), so there's no information leak.
export async function getAgentsByBrand(brandId, userId) {
  if (!userId) throw new Error('getAgentsByBrand: userId is required')
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('agents')
    .select('id, name, status, current_stage, created_at, brands!inner(user_id)')
    .eq('brand_id', brandId)
    .eq('brands.user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  // Strip the join column from the response
  return (data ?? []).map(({ brands, ...agent }) => agent)
}
