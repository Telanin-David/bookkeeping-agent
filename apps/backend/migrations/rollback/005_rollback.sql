-- ============================================================
-- Rollback 005: drop debt payments
-- ============================================================
-- Payment history (amounts and dates) is lost. Each debt keeps its current
-- status, so fully paid debts still read as paid; part-payments are forgotten.
-- Run: psql $DATABASE_URL -f migrations/rollback/005_rollback.sql
-- ============================================================

BEGIN;

DROP VIEW IF EXISTS transactions_with_payments;
DROP TABLE IF EXISTS debt_payments;

COMMIT;
