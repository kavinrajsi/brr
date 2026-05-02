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

export async function getAgentsByBrand(brandId) {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('agents')
    .select('id, name, status, current_stage, created_at')
    .eq('brand_id', brandId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}
