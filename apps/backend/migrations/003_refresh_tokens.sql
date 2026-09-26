-- ============================================================
-- Migration 003: per-device refresh tokens
-- ============================================================
-- Deliverable 6 (auth). Replaces the single users.refresh_token_hash
-- column, which allowed one session per user (logging in on a phone
-- signed the laptop out) and was never checked on refresh.
--
-- Each login starts a token "family"; every refresh revokes the
-- presented token and issues its successor in the same family. If an
-- already-revoked token is presented again, the token was stolen or
-- replayed, so the whole family is revoked.
-- Run: psql $DATABASE_URL -f migrations/003_refresh_tokens.sql
-- ============================================================

BEGIN;

CREATE TABLE refresh_tokens (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    family_id   UUID         NOT NULL,
    token_hash  CHAR(64)     NOT NULL,
    expires_at  TIMESTAMPTZ  NOT NULL,
    revoked_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT refresh_tokens_hash_unique UNIQUE (token_hash)
);

CREATE INDEX idx_refresh_tokens_family ON refresh_tokens (family_id);
CREATE INDEX idx_refresh_tokens_user   ON refresh_tokens (user_id);

-- The old single-session columns never worked (refresh tokens carried no
-- user id), so there are no live sessions in them to migrate.
ALTER TABLE users
    DROP COLUMN refresh_token_hash,
    DROP COLUMN refresh_token_expires_at;

COMMIT;
