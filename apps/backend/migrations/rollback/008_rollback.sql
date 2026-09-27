-- ============================================================
-- Rollback 008: import undo
-- ============================================================
-- Undone imports read as failed. Transactions are not touched.
-- Run: psql $DATABASE_URL -f migrations/rollback/008_rollback.sql
-- ============================================================

BEGIN;

UPDATE excel_imports SET status = 'failed' WHERE status = 'undone';
ALTER TABLE excel_imports DROP COLUMN IF EXISTS skipped_rows;
ALTER TABLE excel_imports DROP COLUMN IF EXISTS imported_rows;
ALTER TABLE excel_imports DROP CONSTRAINT excel_imports_status_check;
ALTER TABLE excel_imports ADD CONSTRAINT excel_imports_status_check CHECK (
    status IN ('uploaded','validating','validated','confirmed','failed')
);

COMMIT;
