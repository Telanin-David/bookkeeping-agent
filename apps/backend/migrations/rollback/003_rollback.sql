-- ============================================================
-- Rollback 003: back to the single users.refresh_token_hash column
-- ============================================================
-- Every session is lost: users must log in again.
-- Run: psql $DATABASE_URL -f migrations/rollback/003_rollback.sql
-- ============================================================

BEGIN;

ALTER TABLE users
    ADD COLUMN refresh_token_hash       VARCHAR(255),
    ADD COLUMN refresh_token_expires_at TIMESTAMPTZ;

DROP TABLE IF EXISTS refresh_tokens;

COMMIT;
