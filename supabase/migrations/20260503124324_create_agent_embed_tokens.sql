-- Origin-bound credentials for the embed widget. Replaces the previous
-- "API key in URL query string" scheme. Token plaintext is returned only on
-- creation; the DB stores SHA-256(token) and verifies the X-Embed-Origin
-- header matches `allowed_origin` at every chat call.
--
-- See src/app/api/agents/[agentId]/embed-tokens/ for the routes that
-- create / list / revoke these, and src/app/api/agents/[agentId]/chat/
-- for the auth path that consumes them.

CREATE TABLE IF NOT EXISTS agent_embed_tokens (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  token_hash      text NOT NULL UNIQUE,
  token_prefix    text NOT NULL,
  name            text NOT NULL,
  allowed_origin  text NOT NULL,
  last_used_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_embed_tokens_agent_id
  ON agent_embed_tokens(agent_id);

CREATE INDEX IF NOT EXISTS idx_agent_embed_tokens_token_hash
  ON agent_embed_tokens(token_hash);

COMMENT ON TABLE agent_embed_tokens IS
  'Origin-bound credentials for the embed widget. Token plaintext is returned only on creation; the DB stores SHA-256(token).';

COMMENT ON COLUMN agent_embed_tokens.allowed_origin IS
  'Exact-match origin allowed to use this token (e.g. https://example.com). Verified against the X-Embed-Origin header at chat time.';

COMMENT ON COLUMN agent_embed_tokens.token_prefix IS
  'First 12 chars of the plaintext token, shown in the dashboard for identification.';
