-- ============================================================
-- Migration 009: business dashboard
-- ============================================================
-- The owner-of-the-app dashboard (/admin): users, AI cost, AI accuracy,
-- who comes back, alert emails. Counts and costs only, never a shop's
-- sales or customers.
--
-- users.is_admin: who can open the dashboard. Set from the server with
--   npm run make-admin -- someone@example.com, never from the app.
-- ai_usage: one row per owner chat message: tokens, estimated cost, and
--   whether the assistant failed to answer.
-- transactions.source: 'chat' when the assistant recorded it.
-- user_active_days: each day an owner opened the app (any signed-in
--   request), for "do people come back". Filled from existing sign-ins,
--   chats and transactions below, then kept up to date by the backend.
-- ai_corrections: an owner changed what the assistant recorded (amount,
--   type, date, who, what, category) or deleted it. Keeps no amounts, and
--   outlives the transaction, so deletes still count.
-- Run: psql $DATABASE_URL -f migrations/009_business_dashboard.sql
-- ============================================================

BEGIN;

ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE ai_usage (
    id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID          NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    shop_id             UUID          NOT NULL REFERENCES shops (id) ON DELETE CASCADE,
    model               VARCHAR(64)   NOT NULL,
    calls               INTEGER       NOT NULL,
    input_tokens        INTEGER       NOT NULL,
    cache_write_tokens  INTEGER       NOT NULL,
    cache_read_tokens   INTEGER       NOT NULL,
    output_tokens       INTEGER       NOT NULL,
    cost_usd            NUMERIC(12,6),
    recorded            INTEGER       NOT NULL DEFAULT 0,  -- transactions the assistant saved
    failed              BOOLEAN       NOT NULL DEFAULT false,
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_usage_created ON ai_usage (created_at);
CREATE INDEX idx_ai_usage_user    ON ai_usage (user_id, created_at);

ALTER TABLE transactions ADD COLUMN source VARCHAR(10) NOT NULL DEFAULT 'app';
ALTER TABLE transactions ADD CONSTRAINT transactions_source_check CHECK (source IN ('app','chat'));

CREATE TABLE ai_corrections (
    id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id  UUID          NOT NULL,
    user_id         UUID          NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    kind            VARCHAR(10)   NOT NULL,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT ai_corrections_kind_check CHECK (kind IN ('edited','deleted'))
);

CREATE INDEX idx_ai_corrections_created ON ai_corrections (created_at);

-- Days are business days in Lagos time, like everything else the owner sees.
CREATE TABLE user_active_days (
    user_id  UUID  NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    day      DATE  NOT NULL,
    PRIMARY KEY (user_id, day)
);

CREATE INDEX idx_user_active_days_day ON user_active_days (day);

INSERT INTO user_active_days (user_id, day)
SELECT user_id, (created_at AT TIME ZONE 'Africa/Lagos')::date FROM refresh_tokens
UNION
SELECT s.user_id, (m.created_at AT TIME ZONE 'Africa/Lagos')::date
  FROM chat_messages m JOIN chat_sessions s ON s.id = m.session_id WHERE m.role = 'user'
UNION
SELECT user_id, (created_at AT TIME ZONE 'Africa/Lagos')::date FROM transactions
ON CONFLICT DO NOTHING;

COMMIT;
