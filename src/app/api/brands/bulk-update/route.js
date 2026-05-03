import { getUserFromRequest, getAdminClient } from '@/lib/supabase-server'
import { onBrandMutated } from '@/lib/cache-invalidation'

// Allowlist of fields a user may modify on a brand. Excludes user_id, created_at,
// status, current_stage, and any other server-owned columns to prevent mass-assignment.
const ALLOWED_BRAND_FIELDS = ['name', 'short_name', 'notes']

function pickAllowed(fields) {
  const out = {}
  for (const key of ALLOWED_BRAND_FIELDS) {
    if (fields[key] !== undefined) out[key] = fields[key]
  }
  return out
}

export async function POST(req) {
  const user = await getUserFromRequest(req)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { updates } = await req.json()

  if (!Array.isArray(updates) || updates.length === 0) {
    return Response.json({ error: 'updates must be a non-empty array' }, { status: 400 })
  }
  if (updates.length > 100) {
    return Response.json({ error: 'Maximum 100 updates at once' }, { status: 400 })
  }

  const supabase = getAdminClient()
  const brandIds = updates.map(u => u.id)

  const { data: owned } = await supabase
    .from('brands')
    .select('id')
    .eq('user_id', user.id)
    .in('id', brandIds)

  if (!owned || owned.length !== brandIds.length) {
    return Response.json({ error: 'You do not own all specified brands' }, { status: 403 })
  }

  const results = []
  let successful = 0
  let failed = 0

  for (const { id, ...fields } of updates) {
    const safeFields = pickAllowed(fields)
    if (Object.keys(safeFields).length === 0) {
      results.push({ id, status: 'failed', error: 'No allowed fields supplied' })
      failed++
      continue
    }
    try {
      const { data, error } = await supabase
        .from('brands')
        .update({ ...safeFields, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) throw error
      onBrandMutated(id, user.id)
      results.push({ id, status: 'success', data })
      successful++
    } catch (err) {
      results.push({ id, status: 'failed', error: err.message })
      failed++
    }
  }

  return Response.json({
    results,
    summary: { total: updates.length, successful, failed },
  })
}
