-- ============================================================
-- Rollback 011: running costs, staff and profit
-- ============================================================
-- The staff list and which costs were stock or running are deleted.
-- Salary payments stay as ordinary expenses. Salary reminders are removed.
-- Run: psql $DATABASE_URL -f migrations/rollback/011_rollback.sql
-- ============================================================

BEGIN;

DELETE FROM alerts WHERE type = 'salary_due';
ALTER TABLE alerts DROP CONSTRAINT alerts_type_check;
ALTER TABLE alerts ADD CONSTRAINT alerts_type_check CHECK (
    type IN ('low_cash','high_payable','overdue_receivable','duplicate','anomaly','low_stock','bill_due')
);

DROP VIEW transactions_with_payments;

DROP TRIGGER IF EXISTS trg_transactions_cost_kind ON transactions;
DROP FUNCTION IF EXISTS set_cost_kind();
DROP INDEX IF EXISTS idx_transactions_shop_date;
ALTER TABLE transactions DROP COLUMN IF EXISTS staff_id;
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_cost_kind_check;
ALTER TABLE transactions DROP COLUMN IF EXISTS cost_kind;
DROP TABLE IF EXISTS staff;

CREATE VIEW transactions_with_payments AS
SELECT t.*,
       CASE
         WHEN t.type IN ('receivable', 'payable') THEN COALESCE(p.paid, 0)
         WHEN t.status = 'settled' THEN t.amount
         ELSE 0
       END AS amount_paid
FROM transactions t
LEFT JOIN (
    SELECT transaction_id, SUM(amount) AS paid FROM debt_payments GROUP BY transaction_id
) p ON p.transaction_id = t.id;

COMMIT;
