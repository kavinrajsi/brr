# BRR AI — Brand-Agnostic Agent Training System

A Next.js platform for training, managing, and deploying brand-aligned AI agents. Each agent goes through a structured 6-stage training pipeline and, once certified, can be embedded into any external tool via a REST API or MCP server.

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 |
| Database / Auth | Supabase (PostgreSQL + Supabase Auth) |
| AI | Anthropic SDK — `claude-haiku-4-5-20251001` |
| Billing | Stripe |
| UI | Tailwind CSS v4 + shadcn/ui |
| External integration | MCP (Model Context Protocol) |

## Features

- **Multi-tenant organizations** — RBAC with four roles: `owner`, `admin`, `member`, `viewer`
- **Brand management** — tone, target audience, response style, prohibited topics, escalation triggers
- **6-stage agent training pipeline** — tracked per-stage with pass/fail checkpoints
- **Agent chat** — live Anthropic-powered responses using a brand system prompt built from config
- **Dual auth** — Supabase session cookies (dashboard) or `brr_live_` API keys (external/MCP)
- **MCP server** — `POST /api/mcp` exposes `list_agents` and `chat_with_agent` tools
- **Billing** — Free / Pro ($29/mo) / Enterprise ($99/mo) plans via Stripe Checkout + webhooks
- **Audit logging** — every org-level mutation is recorded in `audit_logs`
- **Smart caching** — in-process TTL cache with four strategies (`static`, `default`, `short`, `realtime`)
- **Rate limiting** — sliding-window in-memory limiter (swap for Redis/Upstash in production)
- **Security headers** — strict CSP, HSTS, X-Frame-Options, etc. via `next.config.mjs`

## Getting Started

### Prerequisites

- Node.js 20+
- A Supabase project
- An Anthropic API key (for live agent chat)
- Stripe keys (optional — billing UI degrades gracefully without them)

### Environment variables

Copy `.env.local` and fill in real values:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=

NEXT_PUBLIC_APP_NAME=
NEXT_PUBLIC_APP_URL=

ANTHROPIC_API_KEY=

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRO_PRICE_ID=
STRIPE_ENTERPRISE_PRICE_ID=
```

### Run locally

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm run lint
```

## Project Structure

```
src/
├── app/
│   ├── api/                  # Route handlers
│   │   ├── agents/[agentId]/ # chat, training, API keys
│   │   ├── brands/[brandId]/ # config, scenarios
│   │   ├── billing/          # Stripe checkout, portal, webhooks
│   │   ├── organizations/    # RBAC + invites
│   │   ├── mcp/              # MCP server endpoint
│   │   └── admin/            # Audit logs, stats
│   ├── auth/                 # Login, signup, password reset
│   └── dashboard/            # All protected UI pages
├── components/
│   ├── common/               # Header, Sidebar
│   ├── dashboard/            # AgentMetrics, TrainingChart, LoadingCard
│   ├── training/             # StageCard
│   └── ui/                   # shadcn primitives
├── contexts/                 # AuthContext, OrganizationContext
├── hooks/                    # Data-fetching hooks (useAgents, useBrands, …)
└── lib/
    ├── anthropic.js          # Anthropic client + buildBrandSystemPrompt
    ├── training-manager.js   # Stage lifecycle (advance, complete, fail)
    ├── permissions.js        # RBAC table + hasPermission + logAuditAction
    ├── smart-cache.js        # In-process TTL cache
    ├── rate-limiter.js       # Sliding-window rate limiter
    ├── stripe.js             # Stripe client + PLANS constant
    └── supabase-server.js    # Server-side Supabase helpers
```

## API Quick Reference

### Chat with an agent

```bash
curl -X POST /api/agents/<agentId>/chat \
  -H "Authorization: Bearer brr_live_<key>" \
  -H "Content-Type: application/json" \
  -d '{"message": "How do I return an item?"}'
```

Only agents with status `Deployed` or `Certified` respond. All others return `403`.

### MCP endpoint

```
POST /api/mcp
Authorization: Bearer brr_live_<key>
```

Tools: `list_agents`, `chat_with_agent`. Stateless — no session required.

### Training stages

```
GET  /api/agents/:agentId/training           # all stage progress
POST /api/agents/:agentId/training/:stage    # advance / complete a stage
```

Stages run 1–6. Completing stage N automatically advances `current_stage` to N+1.

## Billing Plans

| Plan | Price | Brands | Agents |
|---|---|---|---|
| Free | $0 | 3 | 5 |
| Pro | $29/mo | 20 | 50 |
| Enterprise | $99/mo | ∞ | ∞ |

Stripe webhooks at `/api/billing/webhook` keep the `subscriptions` table in sync.

## Caching Strategy

`src/lib/smart-cache.js` uses four named TTL strategies:

| Strategy | TTL | Use case |
|---|---|---|
| `static` | 1 hour | Brand config, metadata |
| `default` | 5 min | General reads |
| `short` | 1 min | Frequently mutated records |
| `realtime` | 0 | No cache |

The `/api/monitoring/cache` endpoint exposes live hit/miss/eviction stats.

> **Production note:** The rate limiter and smart cache are in-process and reset on cold starts. Replace with Redis or Upstash before scaling horizontally.
