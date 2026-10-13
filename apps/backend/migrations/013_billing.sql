-- ============================================================
-- Migration 013: plans and payments
-- ============================================================
-- What an owner can use depends on what they have paid for. Each paid
-- (or free trial) stretch of time is a row in subscriptions; each payment
-- is a row in payments. Prices and what each plan includes live in the
-- code (services/plans.ts), so they can change without a migration.
--
-- payments: one row per attempt to pay. Paystack payments start
--   'pending' when the owner is sent to Paystack and become 'success'
--   only after Paystack's own server confirms the amount was received.
--   'manual' payments are recorded by an admin for money sent straight
--   to the business's account.
-- subscriptions: a plan from starts_at to ends_at. payment_id is unique,
--   so the same payment can never be turned into two periods, however
--   many times Paystack (or the owner's browser) reports it. One trial
--   per account.
-- app_settings: switches the admin can flip without a deploy.
--   passes_enabled: offer the full-capacity Weekly and Day passes
--   (off until the owner decides to launch them).
-- New alert type 'plan_ending': a paid plan or the trial ends soon.
-- Run: psql $DATABASE_URL -f migrations/013_billing.sql
-- ============================================================

BEGIN;

CREATE TABLE payments (
    id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID          NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    plan         VARCHAR(20)   NOT NULL,
    amount_kobo  BIGINT        NOT NULL,
    currency     VARCHAR(3)    NOT NULL DEFAULT 'NGN',
    provider     VARCHAR(10)   NOT NULL,
    reference    VARCHAR(100)  NOT NULL,
    status       VARCHAR(10)   NOT NULL DEFAULT 'pending',
    -- How it was paid, as Paystack reports it: bank_transfer, card, ussd…
    channel      VARCHAR(30),
    -- Manual payments: who recorded it, and their note ("Transfer from GTB, 12 Oct").
    recorded_by  UUID          REFERENCES users (id) ON DELETE SET NULL,
    note         TEXT,
    paid_at      TIMESTAMPTZ,
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT payments_reference_unique UNIQUE (reference),
    CONSTRAINT payments_plan_check CHECK (plan IN ('monthly','yearly','weekly','day')),
    CONSTRAINT payments_amount_positive CHECK (amount_kobo > 0),
    CONSTRAINT payments_provider_check CHECK (provider IN ('paystack','manual')),
    CONSTRAINT payments_status_check CHECK (status IN ('pending','success','failed')),
    CONSTRAINT payments_paid_at_check CHECK ((status = 'success') = (paid_at IS NOT NULL))
);

CREATE INDEX idx_payments_user ON payments (user_id, created_at DESC);
CREATE INDEX idx_payments_paid ON payments (paid_at) WHERE status = 'success';

CREATE TRIGGER trg_payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE subscriptions (
    id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID          NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    plan        VARCHAR(20)   NOT NULL,
    starts_at   TIMESTAMPTZ   NOT NULL,
    ends_at     TIMESTAMPTZ   NOT NULL,
    payment_id  UUID          REFERENCES payments (id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT subscriptions_plan_check CHECK (plan IN ('trial','monthly','yearly','weekly','day')),
    CONSTRAINT subscriptions_period_check CHECK (ends_at > starts_at),
    CONSTRAINT subscriptions_payment_unique UNIQUE (payment_id),
    CONSTRAINT subscriptions_trial_unpaid CHECK ((plan = 'trial') = (payment_id IS NULL))
);

CREATE INDEX idx_subscriptions_user ON subscriptions (user_id, ends_at);
CREATE UNIQUE INDEX idx_subscriptions_one_trial ON subscriptions (user_id) WHERE plan = 'trial';

CREATE TABLE app_settings (
    key         VARCHAR(50)   PRIMARY KEY,
    value       JSONB         NOT NULL,
    updated_by  UUID          REFERENCES users (id) ON DELETE SET NULL,
    updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

INSERT INTO app_settings (key, value) VALUES ('passes_enabled', 'false');

ALTER TABLE alerts DROP CONSTRAINT alerts_type_check;
ALTER TABLE alerts ADD CONSTRAINT alerts_type_check CHECK (
    type IN ('low_cash','high_payable','overdue_receivable','duplicate','anomaly','low_stock','bill_due','salary_due','plan_ending')
);

COMMIT;
