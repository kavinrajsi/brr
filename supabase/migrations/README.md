# Supabase migrations

Each `.sql` file in this directory corresponds to one schema change.
Filenames follow the Supabase CLI convention: `{YYYYMMDDHHMMSS}_{name}.sql`.
Apply them in filename order.

## Applying to a new / separate database

### Option A — Supabase MCP (this repo's primary path)

```
mcp__claude_ai_Supabase__apply_migration
  project_id: <your-project-ref>
  name:       <migration_name_without_timestamp>
  query:      <contents of the .sql file>
```

### Option B — Supabase CLI

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

### Option C — direct psql

```bash
psql "$DATABASE_URL" -f supabase/migrations/20260503124324_create_agent_embed_tokens.sql
psql "$DATABASE_URL" -f supabase/migrations/20260503125430_create_stripe_events_idempotency.sql
```

All migrations are idempotent (`IF NOT EXISTS` on every CREATE) so re-running
on a database that already has the change is safe.

## Migration log

| File | Purpose | Required by |
|---|---|---|
| `20260503124324_create_agent_embed_tokens.sql` | Origin-bound credentials for the embed widget. Replaces the previous `?key=API_KEY` URL-query pattern. | `src/app/api/agents/[agentId]/embed-tokens/`, `src/app/api/agents/[agentId]/chat/route.js`, `src/app/embed/[agentId]/page.js` |
| `20260503125430_create_stripe_events_idempotency.sql` | Webhook idempotency log. PK constraint is the atomic claim mechanism — Stripe retries no longer re-upsert subscriptions. | `src/app/api/billing/webhook/route.js` |
