-- ============================================================
-- Rollback 009: drop the business dashboard's data
-- ============================================================
-- AI usage and correction history is deleted, and nobody is an admin.
-- ============================================================

BEGIN;

DROP TABLE IF EXISTS user_active_days;
DROP TABLE IF EXISTS ai_corrections;
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_source_check;
ALTER TABLE transactions DROP COLUMN IF EXISTS source;
DROP TABLE IF EXISTS ai_usage;
ALTER TABLE users DROP COLUMN IF EXISTS is_admin;

COMMIT;
