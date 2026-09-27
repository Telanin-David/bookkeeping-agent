-- ============================================================
-- Migration 010: forgot password
-- ============================================================
-- A reset link carries a random token; only its SHA-256 hash is stored.
-- It works once, for an hour, and only for the address it was sent to
-- (a link sent before an email change can't be used afterwards).
-- Run: psql $DATABASE_URL -f migrations/010_password_reset.sql
-- ============================================================

BEGIN;

CREATE TABLE password_reset_tokens (
    id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID          NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    email       VARCHAR(255)  NOT NULL,
    token_hash  CHAR(64)      NOT NULL,
    expires_at  TIMESTAMPTZ   NOT NULL,
    used_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT password_reset_tokens_hash_unique UNIQUE (token_hash)
);

CREATE INDEX idx_password_reset_tokens_user ON password_reset_tokens (user_id);

COMMIT;
