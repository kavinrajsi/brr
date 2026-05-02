import { getUserFromRequest, getAdminClient, dbError } from '@/lib/supabase-server'
import { onBrandMutated } from '@/lib/cache-invalidation'

export async function POST(req) {
  const user = await getUserFromRequest(req)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { brandIds } = await req.json()

  if (!Array.isArray(brandIds) || brandIds.length === 0) {
    return Response.json({ error: 'brandIds must be a non-empty array' }, { status: 400 })
  }
  if (brandIds.length > 50) {
    return Response.json({ error: 'Maximum 50 brands can be deleted at once' }, { status: 400 })
  }

  const supabase = getAdminClient()
  const { data: owned } = await supabase
    .from('brands')
    .select('id')
    .eq('user_id', user.id)
    .in('id', brandIds)

  if (!owned || owned.length !== brandIds.length) {
    return Response.json({ error: 'You do not own all specified brands' }, { status: 403 })
  }

  const { error } = await supabase.from('brands').delete().in('id', brandIds)
  if (error) return dbError(error)

  brandIds.forEach(id => onBrandMutated(id, user.id))
  return Response.json({ message: `Deleted ${brandIds.length} brands`, deleted: brandIds.length })
}
