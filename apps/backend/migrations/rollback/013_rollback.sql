-- ============================================================
-- Rollback 013: plans and payments
-- ============================================================
-- Every payment record, plan period and setting is deleted, and plan
-- reminders are removed. Export payments first if they matter.
-- Run: psql $DATABASE_URL -f migrations/rollback/013_rollback.sql
-- ============================================================

BEGIN;

DELETE FROM alerts WHERE type = 'plan_ending';
ALTER TABLE alerts DROP CONSTRAINT alerts_type_check;
ALTER TABLE alerts ADD CONSTRAINT alerts_type_check CHECK (
    type IN ('low_cash','high_payable','overdue_receivable','duplicate','anomaly','low_stock','bill_due','salary_due')
);

DROP TABLE IF EXISTS app_settings;
DROP TABLE IF EXISTS subscriptions;
DROP TABLE IF EXISTS payments;

COMMIT;
