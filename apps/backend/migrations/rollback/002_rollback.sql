-- ============================================================
-- Rollback 002: drop chat message ↔ transaction linkage
-- ============================================================
-- Run: psql $DATABASE_URL -f migrations/rollback/002_rollback.sql
-- ============================================================

BEGIN;

ALTER TABLE chat_messages
    DROP COLUMN IF EXISTS receipt_transaction_id,
    DROP COLUMN IF EXISTS extracted_transaction_ids;

COMMIT;
