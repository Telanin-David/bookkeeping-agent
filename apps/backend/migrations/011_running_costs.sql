-- ============================================================
-- Migration 011: running costs, staff and profit
-- ============================================================
-- Profit needs to know what money was spent on. Buying goods to resell
-- is not the same as paying rent: the goods come back as sales, the rent
-- doesn't. So every expense and bill now says which it was:
--
-- transactions.cost_kind:
--   'stock'   goods bought to resell (always, when stock items are on it)
--   'running' everything it takes to run the business: salaries, rent,
--             electricity, fuel, transport, phone, repairs…
--   NULL      sales and credit sales (a trigger keeps it that way, and
--             gives a cost that doesn't say 'running').
--   Existing costs: 'stock' if they put items on the shelf or their
--   category looks like stock, otherwise 'running'.
--
-- staff: optional. Owners who pay people can list them with their
--   monthly pay and pay day, for a pay-day reminder (alert 'salary_due')
--   and one-tap "pay salaries". Owners without staff never see any of it.
-- transactions.staff_id: the staff member a salary payment was for.
--
-- The transactions_with_payments view is rebuilt so it carries the new
-- columns (and source, from 009): a view's t.* is fixed when it is made.
-- Run: psql $DATABASE_URL -f migrations/011_running_costs.sql
-- ============================================================

BEGIN;

ALTER TABLE transactions ADD COLUMN cost_kind VARCHAR(10);
ALTER TABLE transactions ADD CONSTRAINT transactions_cost_kind_check CHECK (
    (type IN ('expense', 'payable') AND cost_kind IN ('stock', 'running'))
    OR (type IN ('sale', 'receivable') AND cost_kind IS NULL)
) NOT VALID;

UPDATE transactions t SET cost_kind = CASE
    WHEN EXISTS (SELECT 1 FROM stock_movements m WHERE m.transaction_id = t.id) THEN 'stock'
    WHEN t.category ~* '(stock|goods|inventory|merchandise|resale)' THEN 'stock'
    ELSE 'running'
  END
WHERE t.type IN ('expense', 'payable');

ALTER TABLE transactions VALIDATE CONSTRAINT transactions_cost_kind_check;

CREATE OR REPLACE FUNCTION set_cost_kind()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.type IN ('sale', 'receivable') THEN
        NEW.cost_kind := NULL;
    ELSIF NEW.cost_kind IS NULL THEN
        NEW.cost_kind := 'running';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_transactions_cost_kind
    BEFORE INSERT OR UPDATE OF type, cost_kind ON transactions
    FOR EACH ROW EXECUTE FUNCTION set_cost_kind();

CREATE INDEX idx_transactions_shop_date ON transactions (shop_id, date);

CREATE TABLE staff (
    id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id      UUID          NOT NULL REFERENCES shops (id) ON DELETE CASCADE,
    user_id      UUID          NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name         VARCHAR(100)  NOT NULL,
    role         VARCHAR(100),
    monthly_pay  DECIMAL(15,2),
    -- Day of the month they are paid (29–31 means the month's last day in shorter months).
    pay_day      SMALLINT,
    archived_at  TIMESTAMPTZ,
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT staff_name_not_blank CHECK (length(trim(name)) > 0),
    CONSTRAINT staff_pay_check CHECK (monthly_pay IS NULL OR monthly_pay > 0),
    CONSTRAINT staff_pay_day_check CHECK (pay_day IS NULL OR pay_day BETWEEN 1 AND 31)
);

CREATE INDEX idx_staff_shop ON staff (shop_id) WHERE archived_at IS NULL;

CREATE TRIGGER trg_staff_updated_at
    BEFORE UPDATE ON staff
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE transactions ADD COLUMN staff_id UUID REFERENCES staff (id) ON DELETE SET NULL;
CREATE INDEX idx_transactions_staff ON transactions (staff_id, date) WHERE staff_id IS NOT NULL;

ALTER TABLE alerts DROP CONSTRAINT alerts_type_check;
ALTER TABLE alerts ADD CONSTRAINT alerts_type_check CHECK (
    type IN ('low_cash','high_payable','overdue_receivable','duplicate','anomaly','low_stock','bill_due','salary_due')
);

DROP VIEW transactions_with_payments;
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
