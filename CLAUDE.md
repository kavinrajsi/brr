# CLAUDE.md

## Project

BRR AI — Next.js 16 (App Router) + Supabase + Anthropic + Stripe SaaS platform for training and deploying brand-aligned AI agents.

## Commands

```bash
npm run dev       # start dev server (http://localhost:3000)
npm run build     # production build
npm run lint      # ESLint
```

## Architecture

See `AGENTS.md` for the full architecture guide. Short version:

- **Route handlers** live in `src/app/api/`. Always use `getAdminClient()` (service role) from `src/lib/supabase-server.js` — never the browser client.
- **Auth is dual-mode**: Supabase session cookie (`getUserFromRequest`) for dashboard users; `brr_live_` Bearer token for external/MCP callers.
- **Anthropic client** (`src/lib/anthropic.js`) is nullable — guard with `isAnthropicConfigured()` before every call. Model: `claude-haiku-4-5-20251001`.
- **Training pipeline** has 6 stages. All stage mutations go through `src/lib/training-manager.js`.
- **RBAC** checked via `hasPermission(userId, orgId, permission)` in `src/lib/permissions.js`.
- **Billing plan limits** are enforced in route handlers; source of truth is `PLANS` in `src/lib/stripe.js`.
- **Audit log** every org-level mutation with `logAuditAction` from `src/lib/permissions.js`.

## Key Rules

1. Never write directly to `training_progress` or `agents.current_stage` from a route handler — use `training-manager.js`.
2. Always check agent ownership before returning or mutating agent data.
3. Only agents with status `Deployed` or `Certified` can receive chat — enforce with `403`.
4. After any mutation that affects a cached resource, call `smartCache.delete(key)` or use `src/lib/cache-invalidation.js`.
5. The `rateLimiter` and `smartCache` are in-process; they reset on cold starts. Note this in PR descriptions if it matters.
6. All new MCP tools go in `src/app/api/mcp/route.js` and must scope-check the API key before querying.

## Environment Variables

Required for full functionality:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
STRIPE_SECRET_KEY          (optional — billing degrades gracefully)
STRIPE_WEBHOOK_SECRET
STRIPE_PRO_PRICE_ID
STRIPE_ENTERPRISE_PRICE_ID
```

## Supabase Tables (core)

| Table | Purpose |
|---|---|
| `agents` | Agent records with `current_stage`, `status` |
| `training_progress` | Per-stage records (`In Progress`, `Complete`, `Failed`) |
| `agent_api_keys` | Hashed external API keys (`key_hash` = SHA-256) |
| `brands` | Brand records owned by a user |
| `brand_configs` | JSONB config (tone, values, prohibited topics, etc.) |
| `organization_members` | `(user_id, organization_id, role)` |
| `audit_logs` | Immutable org-level action log |
| `subscriptions` | Stripe subscription mirror |

## Caching Quick Reference

```js
import { smartCache } from '@/lib/smart-cache'

smartCache.set(key, value, 'static')   // 1 hour
smartCache.set(key, value, 'default')  // 5 min
smartCache.set(key, value, 'short')    // 1 min
// strategy 'realtime' → no-op (data not cached)
```

## Security Headers

Configured in `next.config.mjs` for all routes: strict CSP (no `unsafe-eval` in prod), HSTS, X-Frame-Options DENY, X-Content-Type-Options, Referrer-Policy, Permissions-Policy. Do not relax these without a documented reason.
