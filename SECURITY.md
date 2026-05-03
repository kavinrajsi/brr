# Security Policy

## Reporting a vulnerability

If you have discovered a security vulnerability in BRR AI, please **do not file a public issue**. Email **security@madarth.com** with:

- A description of the issue and the impact
- Steps to reproduce (proof-of-concept, request/response, or screenshots)
- Affected versions / commits if known
- Any suggested remediation

We aim to:

- Acknowledge receipt within **48 hours**
- Provide an initial assessment within **5 business days**
- Patch high-severity issues within **14 days** of confirmation

Please give us a reasonable window to remediate before public disclosure.

## Scope

In scope:
- The `brr-ai` web application and its API routes (`src/app/api/`)
- Authentication, RBAC, billing, and webhook surfaces
- The MCP server endpoint (`/api/mcp`)
- Outbound webhooks (`src/lib/webhook.js`)

Out of scope:
- Third-party services we depend on (Supabase, Anthropic, Stripe) — please report to those vendors directly
- Denial of service via volume from a legitimately-issued API key (we have rate limits but not infinite capacity)
- Issues requiring physical access or social engineering of staff

## What we ask researchers to avoid

- Do not access, modify, or delete data that is not your own
- Do not run automated scanners against production
- Do not attempt to deplete the Anthropic budget for testing
- Do not exfiltrate user data — proof of access (e.g. a screenshot of your own session token) is sufficient

## Security-relevant configuration

| Concern | Mechanism |
|---|---|
| Platform admin gate | `ADMIN_USER_IDS` env (allowlist of Supabase user UUIDs) |
| API keys | SHA-256 hashed at rest; plaintext returned once |
| Invite tokens | SHA-256 hashed at rest; plaintext returned once |
| Outbound webhooks | HTTPS only, SSRF guard, 8s timeout, signed with HMAC + timestamp |
| Stripe webhook | Signature verified via `stripe.webhooks.constructEvent`; userId cross-checked against email |
| Rate limits | 60 req/min/agent on chat and MCP; 20 req/min on invites; per-user buckets elsewhere |
| Prompt injection | `sanitizePromptValue()` in `src/lib/anthropic.js` strips control chars and neutralises common jailbreak patterns |
