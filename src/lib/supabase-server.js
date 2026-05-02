import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Module-level singleton — avoids creating a new TCP connection per request
// within the same serverless worker lifetime.
let _adminClient = null

// Used only in API route handlers (server-side)
export function getAdminClient() {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY — add it to .env.local')
  }
  if (!_adminClient) {
    _adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  }
  return _adminClient
}

export async function getUserFromRequest(req) {
  const authHeader = req.headers.get('Authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return null

  const supabase = getAdminClient()
  const { data: { user } } = await supabase.auth.getUser(token)
  return user || null
}

// Sanitize DB errors before sending to clients.
// Logs the real message server-side; returns a generic one to the caller.
export function dbError(error, status = 400) {
  console.error('[db]', error?.message)
  return Response.json({ error: 'An unexpected error occurred' }, { status })
}
