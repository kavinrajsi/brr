import { getAdminClient } from './supabase-server'

export const ROLE_PERMISSIONS = {
  owner: {
    'org:read': true, 'org:update': true, 'org:delete': true, 'org:settings': true,
    'member:invite': true, 'member:remove': true, 'member:role': true, 'member:view': true,
    'brand:create': true, 'brand:read': true, 'brand:update': true, 'brand:delete': true,
    'agent:create': true, 'agent:read': true, 'agent:update': true, 'agent:delete': true,
    'admin:logs': true, 'admin:settings': true,
  },
  admin: {
    'org:read': true, 'org:update': true, 'org:settings': true,
    'member:invite': true, 'member:remove': true, 'member:view': true,
    'brand:create': true, 'brand:read': true, 'brand:update': true, 'brand:delete': true,
    'agent:create': true, 'agent:read': true, 'agent:update': true, 'agent:delete': true,
    'admin:logs': true,
  },
  member: {
    'org:read': true,
    'member:view': true,
    'brand:create': true, 'brand:read': true, 'brand:update': true,
    'agent:create': true, 'agent:read': true, 'agent:update': true,
  },
  viewer: {
    'org:read': true,
    'brand:read': true,
    'agent:read': true,
  },
}

export async function getUserRole(userId, orgId) {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', orgId)
    .eq('user_id', userId)
    .single()

  if (error || !data) return null
  return data.role
}

export async function hasPermission(userId, orgId, permission) {
  const role = await getUserRole(userId, orgId)
  if (!role) return false
  return ROLE_PERMISSIONS[role]?.[permission] === true
}

export async function logAuditAction(orgId, userId, action, resource = {}) {
  const supabase = getAdminClient()
  const { error } = await supabase.from('audit_logs').insert([{
    organization_id: orgId,
    user_id: userId,
    action,
    resource_type: resource.type ?? null,
    resource_id: resource.id ?? null,
    changes: resource.changes ?? {},
  }])
  if (error) console.error('Audit log error:', error.message)
}
