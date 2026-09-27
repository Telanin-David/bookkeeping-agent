-- ============================================================
-- Migration 007: alert detection and email delivery
-- ============================================================
-- Deliverable 8 (email only for now; SMS/WhatsApp later).
--
-- email_verification_tokens: alerts carry customer names and amounts, so
--   they are emailed only to an address its owner has confirmed. Tokens
--   are stored hashed, used once, and expire.
-- alerts.source_key: what an alert is about (e.g. 'overdue:<transaction id>'),
--   so the same thing never raises two open alerts. A resolved alert frees
--   the key, so the same debt can be flagged again if it falls overdue again.
-- New alert type 'bill_due': a bill the shop owes is due soon or overdue.
-- Run: psql $DATABASE_URL -f migrations/007_alert_delivery.sql
-- ============================================================

BEGIN;

CREATE TABLE email_verification_tokens (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash  CHAR(64)     NOT NULL,
    email       VARCHAR(255) NOT NULL,
    expires_at  TIMESTAMPTZ  NOT NULL,
    used_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT email_verification_tokens_hash_unique UNIQUE (token_hash)
);

CREATE INDEX idx_email_verification_tokens_user ON email_verification_tokens (user_id);

ALTER TABLE alerts ADD COLUMN source_key TEXT;
CREATE UNIQUE INDEX idx_alerts_source_key_open ON alerts (source_key)
    WHERE source_key IS NOT NULL AND status <> 'resolved';

ALTER TABLE alerts DROP CONSTRAINT alerts_type_check;
ALTER TABLE alerts ADD CONSTRAINT alerts_type_check CHECK (
    type IN ('low_cash','high_payable','overdue_receivable','duplicate','anomaly','low_stock','bill_due')
);

-- Finding undelivered alerts quickly.
CREATE INDEX idx_alert_history_alert_channel ON alert_history (alert_id, channel);

COMMIT;
