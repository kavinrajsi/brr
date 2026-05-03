import { getUserFromRequest, getAdminClient, dbError } from '@/lib/supabase-server'
import { assertBrandOwner, logAuditAction } from '@/lib/permissions'
import { validateWebhookUrl } from '@/lib/webhook'

export async function GET(req, { params }) {
  const user = await getUserFromRequest(req)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { brandId } = await params
  const supabase = getAdminClient()

  const owned = await assertBrandOwner(supabase, brandId, user.id)
  if (!owned) return Response.json({ error: 'Brand not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('brand_configs')
    .select('*')
    .eq('brand_id', brandId)
    .single()

  // PGRST116 = no rows found — that's fine, config hasn't been created yet
  if (error && error.code !== 'PGRST116') {
    return dbError(error)
  }

  return Response.json(data ?? { brand_id: brandId, config: {} })
}

export async function PUT(req, { params }) {
  const user = await getUserFromRequest(req)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { brandId } = await params
  const supabase = getAdminClient()

  const owned = await assertBrandOwner(supabase, brandId, user.id)
  if (!owned) return Response.json({ error: 'Brand not found' }, { status: 404 })

  const { config } = await req.json()

  // SSRF guard: reject internal/private webhook URLs at save time, not at fire time
  if (config?.webhook_url && String(config.webhook_url).trim()) {
    const validation = validateWebhookUrl(String(config.webhook_url).trim())
    if (!validation.ok) {
      return Response.json({ error: validation.error }, { status: 400 })
    }
  }

  const { data: existing } = await supabase
    .from('brand_configs')
    .select('id')
    .eq('brand_id', brandId)
    .single()

  const { data, error } = existing
    ? await supabase
        .from('brand_configs')
        .update({ config, updated_at: new Date().toISOString() })
        .eq('brand_id', brandId)
        .select()
        .single()
    : await supabase
        .from('brand_configs')
        .insert([{ brand_id: brandId, config }])
        .select()
        .single()

  if (error) return dbError(error)

  await logAuditAction(null, user.id, 'brand_config_updated', {
    type: 'brand_config', id: brandId,
    // Log only the keys changed, not their values — config can contain
    // long-form text and is not safe to mirror into audit_logs.
    changes: { keys: Object.keys(config ?? {}) },
  })

  return Response.json(data)
}
