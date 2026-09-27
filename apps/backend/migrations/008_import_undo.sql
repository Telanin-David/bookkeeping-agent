-- ============================================================
-- Migration 008: finishing the spreadsheet import (Deliverable 9)
-- ============================================================
-- An import can be undone: its transactions (tagged with import_id) are
-- deleted and the import is marked 'undone'. imported_rows records how
-- many transactions an import created, and skipped_rows how many were
-- left out (problems or already in the records).
-- Run: psql $DATABASE_URL -f migrations/008_import_undo.sql
-- ============================================================

BEGIN;

ALTER TABLE excel_imports DROP CONSTRAINT excel_imports_status_check;
ALTER TABLE excel_imports ADD CONSTRAINT excel_imports_status_check CHECK (
    status IN ('uploaded','validating','validated','confirmed','failed','undone')
);
ALTER TABLE excel_imports ADD COLUMN imported_rows INTEGER;
ALTER TABLE excel_imports ADD COLUMN skipped_rows INTEGER;

COMMIT;
