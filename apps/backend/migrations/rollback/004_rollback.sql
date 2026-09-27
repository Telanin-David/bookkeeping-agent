-- ============================================================
-- Rollback 004: drop shop branding columns
-- ============================================================
-- The uploaded image files are left on disk; delete the branding
-- upload folder by hand if they are no longer wanted.
-- Run: psql $DATABASE_URL -f migrations/rollback/004_rollback.sql
-- ============================================================

BEGIN;

ALTER TABLE shops
    DROP COLUMN IF EXISTS signature_key,
    DROP COLUMN IF EXISTS logo_key;

COMMIT;
