-- Webhook idempotency log. Stripe retries failed deliveries; recording
-- event.id here lets us short-circuit duplicates so subscription state is
-- never re-applied. The PRIMARY KEY UNIQUE constraint is the atomic claim
-- mechanism — a duplicate INSERT raises 23505 (unique_violation) which
-- the webhook handler treats as "already processed".
--
-- See src/app/api/billing/webhook/route.js for the consumer.

CREATE TABLE IF NOT EXISTS stripe_events (
  id            text PRIMARY KEY,                    -- Stripe's evt_xxx id (unique per event)
  type          text NOT NULL,
  processed_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stripe_events_processed_at
  ON stripe_events(processed_at DESC);

COMMENT ON TABLE stripe_events IS
  'Webhook idempotency log. Stripe retries failed deliveries; recording event.id here lets us short-circuit duplicates so subscription state is never re-applied.';
