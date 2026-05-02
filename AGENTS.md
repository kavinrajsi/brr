# AGENTS.md — Guide for AI Coding Assistants

This file describes BRR AI's architecture, conventions, and rules for AI agents (Claude Code, Cursor, Copilot, etc.) working in this repository.

## What This Project Does

BRR AI is a multi-tenant SaaS platform where users create **brands**, train **agents** through a 6-stage pipeline, and deploy those agents to answer customer questions in a brand-aligned voice. Deployed agents are available via REST API and an MCP server.

## Architecture at a Glance

```
User request
    │
    ▼
Next.js Route Handler (App Router, server-side)
    │
    ├─ Auth: Supabase session cookie  ──► dashboard flows
    └─ Auth: brr_live_<key> header   ──► external / MCP flows
         │
         ▼
    Supabase (PostgreSQL)
         │
         └─ Anthropic API (claude-haiku-4-5-20251001)
              for chat/route.js and mcp/route.js
```

## Key Conventions

### Auth — dual mode

Every protected API route must handle **both** auth paths:

1. `getUserFromRequest(req)` — validates the Supabase session cookie (dashboard users)
2. `brr_live_` API key — SHA-256 hash matched against `agent_api_keys.key_hash`

The chat and MCP routes are the canonical examples of this pattern. Do not add a new auth method without updating both paths.

### Database access — always use service role on the server

All server-side Supabase calls go through `getAdminClient()` from `src/lib/supabase-server.js`. Never use the public anon client in route handlers — Row Level Security is intentionally bypassed in favour of explicit ownership checks in the handler code.

### RBAC

Permissions are checked with `hasPermission(userId, orgId, permission)` from `src/lib/permissions.js`. The full permission matrix is defined in `ROLE_PERMISSIONS` in the same file. Roles: `owner > admin > member > viewer`. Add new permissions there first; do not hard-code role names elsewhere.

### Anthropic client

`src/lib/anthropic.js` exports a nullable `anthropic` instance — it is `null` when `ANTHROPIC_API_KEY` is absent. Always guard with `isAnthropicConfigured()` before calling it. All chat flows use `claude-haiku-4-5-20251001` at `max_tokens: 512`.

The system prompt is built by `buildBrandSystemPrompt(brandName, config)` using the brand's stored config fields (tone, target_audience, response_style, key_values, prohibited_topics, escalation_triggers).

### Training pipeline

Agents progress through stages 1–6. Stage state lives in two tables:

- `agents.current_stage` — the active stage number
- `training_progress` — one row per (agent, stage) with status `In Progress | Complete | Failed`

Use functions from `src/lib/training-manager.js`:

```
createTrainingCheckpoint(agentId, stage, validationData)
completeStage(agentId, stage, results)   // auto-advances current_stage
failStage(agentId, stage, reason)
```

Never write directly to these tables from route handlers.

### Agent status lifecycle

```
Draft → In Training → Certified → Deployed
```

Only agents with status `Deployed` or `Certified` can receive chat requests. The chat route enforces this with a `403` response.

### Caching

Use `smartCache` from `src/lib/smart-cache.js` for server-side reads. Pick the right TTL strategy:

- `static` — brand configs, rarely changed metadata
- `default` — most reads
- `short` — records that mutate frequently (e.g. agent status)
- `realtime` — skip cache entirely

Always call `smartCache.delete(key)` or use `src/lib/cache-invalidation.js` after mutations.

### Rate limiting

`rateLimiter` from `src/lib/rate-limiter.js` is in-process. It resets on cold starts. Use it for per-IP or per-key limits on public endpoints. For production scale, replace the backing store with Redis/Upstash.

### MCP server

`src/app/api/mcp/route.js` is stateless — `sessionIdGenerator: undefined`. The server exposes two tools: `list_agents` and `chat_with_agent`. When adding a new MCP tool, follow the existing pattern: validate the API key scope first, then query Supabase.

### Billing

Plan limits are in `src/lib/stripe.js` → `PLANS`. Free: 3 brands / 5 agents. Pro: 20/50. Enterprise: unlimited. Enforce limits in route handlers before creating new brands or agents. Stripe webhooks update the `subscriptions` table; do not modify subscription state anywhere else.

### Audit logging

Every org-level mutation (create, update, delete on brands, agents, members) must call:

```js
logAuditAction(orgId, userId, 'action.name', { type: 'resource_type', id: resourceId, changes: {} })
```

`logAuditAction` is fire-and-forget (errors are logged but not thrown).

## File Naming & Placement

| What | Where |
|---|---|
| API routes | `src/app/api/<resource>/[id]/route.js` |
| Pages | `src/app/dashboard/<section>/page.js` |
| Shared business logic | `src/lib/` |
| React hooks (data fetching) | `src/hooks/use<Resource>.js` |
| Context providers | `src/contexts/<Name>Context.js` |
| UI primitives | `src/components/ui/` (shadcn) |
| Feature components | `src/components/<feature>/` |

## What NOT to Do

- Do not import `supabase` from `src/lib/supabase.js` in server route handlers — that is the browser client.
- Do not call Anthropic directly in a route handler; use the exported `anthropic` instance and guard with `isAnthropicConfigured()`.
- Do not hard-code model names in new code — use the constant from `src/lib/anthropic.js` or document clearly if you must deviate.
- Do not skip the ownership check (`assertAgentOwner` or equivalent) before returning or mutating agent data.
- Do not mutate `training_progress` or `agents.current_stage` outside of `training-manager.js`.
- Do not add a new billing plan without adding it to `PLANS` in `src/lib/stripe.js`.
