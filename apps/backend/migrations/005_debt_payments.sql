-- ============================================================
-- Migration 005: payments against debts (part-payments + payment dates)
-- ============================================================
-- Deliverable 7. A credit sale (receivable) or bill on credit (payable) can
-- now be paid in parts, each on its own date. A debt's status follows its
-- payments: 'settled' once they cover the amount. Payment dates let reports
-- show what was owed on any past date, not just today.
--
-- transactions_with_payments adds amount_paid to every transaction: the sum
-- of its payments for debts; for cash sales/expenses, the full amount once
-- settled. Reads go through the view; writes still go to transactions.
-- Run: psql $DATABASE_URL -f migrations/005_debt_payments.sql
-- ============================================================

BEGIN;

CREATE TABLE debt_payments (
    id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id  UUID          NOT NULL REFERENCES transactions (id) ON DELETE CASCADE,
    shop_id         UUID          NOT NULL REFERENCES shops (id) ON DELETE CASCADE,
    user_id         UUID          NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    amount          DECIMAL(15,2) NOT NULL,
    paid_on         DATE          NOT NULL,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT debt_payments_amount_positive CHECK (amount > 0)
);

CREATE INDEX idx_debt_payments_transaction ON debt_payments (transaction_id);
CREATE INDEX idx_debt_payments_shop_paid_on ON debt_payments (shop_id, paid_on);

-- Debts already marked paid get one payment for the full amount. When they were
-- really paid was never recorded; the day they were last changed is the closest
-- record there is.
INSERT INTO debt_payments (transaction_id, shop_id, user_id, amount, paid_on)
SELECT id, shop_id, user_id, amount, (updated_at AT TIME ZONE 'Africa/Lagos')::date
FROM transactions
WHERE type IN ('receivable', 'payable') AND status = 'settled';

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
