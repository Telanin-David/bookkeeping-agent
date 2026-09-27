-- ============================================================
-- Rollback 007: drop email verification and alert source keys
-- ============================================================
-- Verification links already sent stop working; verified accounts stay
-- verified. 'bill_due' alerts are deleted.
-- Run: psql $DATABASE_URL -f migrations/rollback/007_rollback.sql
-- ============================================================

BEGIN;

DROP INDEX IF EXISTS idx_alert_history_alert_channel;
DELETE FROM alerts WHERE type = 'bill_due';
ALTER TABLE alerts DROP CONSTRAINT alerts_type_check;
ALTER TABLE alerts ADD CONSTRAINT alerts_type_check CHECK (
    type IN ('low_cash','high_payable','overdue_receivable','duplicate','anomaly','low_stock')
);
DROP INDEX IF EXISTS idx_alerts_source_key_open;
ALTER TABLE alerts DROP COLUMN IF EXISTS source_key;
DROP TABLE IF EXISTS email_verification_tokens;

COMMIT;
