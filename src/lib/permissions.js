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

// Short-lived in-memory cache for (userId, orgId) → role lookups.
// Resets on cold starts in serverless — fine since roles change rarely
// and a stale cache only causes a brief over/under-permission window.
const ROLE_CACHE_TTL_MS = 30_000
const roleCache = new Map() // key: `${userId}:${orgId}`, value: { role, expiresAt }

function invalidateRoleCacheFor(userId) {
  for (const k of roleCache.keys()) if (k.startsWith(`${userId}:`)) roleCache.delete(k)
}

export async function getUserRole(userId, orgId) {
  const key = `${userId}:${orgId}`
  const cached = roleCache.get(key)
  if (cached && cached.expiresAt > Date.now()) return cached.role

  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', orgId)
    .eq('user_id', userId)
    .single()

  const role = error || !data ? null : data.role
  roleCache.set(key, { role, expiresAt: Date.now() + ROLE_CACHE_TTL_MS })
  return role
}

export async function hasPermission(userId, orgId, permission) {
  const role = await getUserRole(userId, orgId)
  if (!role) return false
  return ROLE_PERMISSIONS[role]?.[permission] === true
}

// orgId may be null for personal-account mutations (a brand or agent owned
// directly by a user with no organisation). audit_logs.organization_id is
// nullable in the schema; the personal event is then visible only to that
// user (see /api/admin/audit which OR's user_id = caller).
export async function logAuditAction(orgId, userId, action, resource = {}) {
  const supabase = getAdminClient()
  const { error } = await supabase.from('audit_logs').insert([{
    organization_id: orgId ?? null,
    user_id: userId,
    action,
    resource_type: resource.type ?? null,
    resource_id: resource.id ?? null,
    changes: resource.changes ?? {},
  }])
  if (error) {
    // Surface as a structured warning so it shows up in monitoring rather than
    // disappearing silently. A privilege change without a trail is a real risk.
    console.warn(JSON.stringify({
      level: 'warn',
      event: 'audit_log_failed',
      orgId,
      userId,
      action,
      resourceType: resource.type ?? null,
      resourceId: resource.id ?? null,
      error: error.message,
      timestamp: new Date().toISOString(),
    }))
  }
}

// Call when a role/membership changes so the next permission check refetches.
export function invalidateRoleCache(userId) {
  invalidateRoleCacheFor(userId)
}

// ─── Centralised ownership helpers ────────────────────────────────────────────
// Previously copy-pasted across ~8 routes. Kept signature-compatible: returns
// the row when owned, null otherwise.

export async function assertBrandOwner(supabase, brandId, userId) {
  const { data, error } = await supabase
    .from('brands')
    .select('id, name, user_id')
    .eq('id', brandId)
    .eq('user_id', userId)
    .single()
  return !error && data ? data : null
}

export async function assertAgentOwner(supabase, agentId, userId) {
  const { data, error } = await supabase
    .from('agents')
    .select('id, brand_id, brands!inner(id, name, user_id)')
    .eq('id', agentId)
    .eq('brands.user_id', userId)
    .single()
  return !error && data ? data : null
}
