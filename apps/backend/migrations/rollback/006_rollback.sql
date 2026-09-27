-- ============================================================
-- Rollback 006: drop stock tracking
-- ============================================================
-- Products and their stock history are lost; sales and expenses are kept.
-- Low-stock alerts are deleted, and alerts the app had resolved read as dismissed.
-- Run: psql $DATABASE_URL -f migrations/rollback/006_rollback.sql
-- ============================================================

BEGIN;

DROP TABLE IF EXISTS stock_movements;
DROP TABLE IF EXISTS products;
DROP FUNCTION IF EXISTS apply_stock_movement();

DELETE FROM alerts WHERE type = 'low_stock';
UPDATE alerts SET status = 'dismissed' WHERE status = 'resolved';
ALTER TABLE alerts DROP CONSTRAINT alerts_type_check;
ALTER TABLE alerts ADD CONSTRAINT alerts_type_check CHECK (
    type IN ('low_cash','high_payable','overdue_receivable','duplicate','anomaly')
);
ALTER TABLE alerts DROP CONSTRAINT alerts_status_check;
ALTER TABLE alerts ADD CONSTRAINT alerts_status_check CHECK (
    status IN ('active','acknowledged','dismissed')
);

COMMIT;
