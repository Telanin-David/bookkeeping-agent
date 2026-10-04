-- ============================================================
-- Rollback 012: what the assistant did, kept with its reply
-- ============================================================
-- Run: psql $DATABASE_URL -f migrations/rollback/012_rollback.sql
-- ============================================================

BEGIN;

ALTER TABLE chat_messages DROP COLUMN IF EXISTS actions;

COMMIT;
