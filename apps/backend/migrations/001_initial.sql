-- ============================================================
-- Migration 001: Initial schema
-- ============================================================
-- Run:      psql $DATABASE_URL -f migrations/001_initial.sql
-- Rollback: psql $DATABASE_URL -f migrations/rollback/001_rollback.sql
-- ============================================================

BEGIN;

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── users ────────────────────────────────────────────────────
CREATE TABLE users (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                    VARCHAR(100)  NOT NULL,
    email                   VARCHAR(255)  NOT NULL,
    phone                   VARCHAR(20),
    password_hash           VARCHAR(255)  NOT NULL,
    email_verified          BOOLEAN       NOT NULL DEFAULT false,

    -- Alert delivery preferences
    alert_email             BOOLEAN       NOT NULL DEFAULT true,
    alert_sms               BOOLEAN       NOT NULL DEFAULT false,
    alert_whatsapp          BOOLEAN       NOT NULL DEFAULT false,
    alert_quiet_start       TIME          NOT NULL DEFAULT '22:00',
    alert_quiet_end         TIME          NOT NULL DEFAULT '07:00',

    -- Alert thresholds
    threshold_low_cash      DECIMAL(15,2) NOT NULL DEFAULT 10000,
    threshold_high_payable  DECIMAL(15,2) NOT NULL DEFAULT 50000,
    threshold_overdue_days  INTEGER       NOT NULL DEFAULT 30,

    -- Auth session management
    refresh_token_hash      VARCHAR(255),
    refresh_token_expires_at TIMESTAMPTZ,
    login_attempts          INTEGER       NOT NULL DEFAULT 0,
    lockout_until           TIMESTAMPTZ,

    created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT users_email_unique UNIQUE (email)
);

CREATE INDEX idx_users_email ON users (email);

-- ── shops ────────────────────────────────────────────────────
CREATE TABLE shops (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id    UUID         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name        VARCHAR(150) NOT NULL,
    type        VARCHAR(50)  NOT NULL,
    location    VARCHAR(255),
    currency    VARCHAR(10)  NOT NULL DEFAULT 'NGN',
    is_active   BOOLEAN      NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT shops_type_check CHECK (type IN ('retail','wholesale','services','food','other'))
);

CREATE INDEX idx_shops_owner_id ON shops (owner_id);

-- ── excel_imports ────────────────────────────────────────────
-- Declared before transactions so transactions can FK to it.
CREATE TABLE excel_imports (
    id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    shop_id          UUID         NOT NULL REFERENCES shops (id) ON DELETE CASCADE,
    filename         VARCHAR(255) NOT NULL,
    file_path        TEXT,
    status           VARCHAR(20)  NOT NULL DEFAULT 'uploaded',
    row_count        INTEGER,
    valid_rows       INTEGER,
    error_rows       INTEGER,
    quality_score    DECIMAL(4,3),
    column_mapping   JSONB,
    error_log        JSONB,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT excel_imports_status_check CHECK (
        status IN ('uploaded','validating','validated','confirmed','failed')
    ),
    CONSTRAINT excel_imports_quality_score_check CHECK (
        quality_score IS NULL OR (quality_score >= 0 AND quality_score <= 1)
    )
);

CREATE INDEX idx_excel_imports_user_id  ON excel_imports (user_id);
CREATE INDEX idx_excel_imports_shop_id  ON excel_imports (shop_id);
CREATE INDEX idx_excel_imports_status   ON excel_imports (status);

-- ── transactions ─────────────────────────────────────────────
CREATE TABLE transactions (
    id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id         UUID          NOT NULL REFERENCES shops (id) ON DELETE CASCADE,
    user_id         UUID          NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    type            VARCHAR(20)   NOT NULL,
    amount          DECIMAL(15,2) NOT NULL,
    currency        VARCHAR(10)   NOT NULL DEFAULT 'NGN',
    description     TEXT,
    category        VARCHAR(100),
    counterparty    VARCHAR(255),
    date            DATE          NOT NULL,
    due_date        DATE,
    status          VARCHAR(20)   NOT NULL DEFAULT 'pending',
    ai_categorized  BOOLEAN       NOT NULL DEFAULT false,
    import_id       UUID          REFERENCES excel_imports (id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT transactions_type_check CHECK (
        type IN ('sale','expense','receivable','payable')
    ),
    CONSTRAINT transactions_status_check CHECK (
        status IN ('pending','settled','overdue')
    ),
    CONSTRAINT transactions_amount_positive CHECK (amount > 0),
    CONSTRAINT transactions_due_date_check CHECK (
        due_date IS NULL OR type IN ('receivable','payable')
    )
);

CREATE INDEX idx_transactions_shop_id   ON transactions (shop_id);
CREATE INDEX idx_transactions_user_id   ON transactions (user_id);
CREATE INDEX idx_transactions_date      ON transactions (date);
CREATE INDEX idx_transactions_type      ON transactions (type);
CREATE INDEX idx_transactions_status    ON transactions (status);
CREATE INDEX idx_transactions_category  ON transactions (category);
CREATE INDEX idx_transactions_due_date  ON transactions (due_date) WHERE due_date IS NOT NULL;
CREATE INDEX idx_transactions_import_id ON transactions (import_id) WHERE import_id IS NOT NULL;

-- ── chat_sessions ────────────────────────────────────────────
CREATE TABLE chat_sessions (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    shop_id         UUID        NOT NULL REFERENCES shops (id) ON DELETE CASCADE,
    last_message_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_sessions_user_id ON chat_sessions (user_id);
CREATE INDEX idx_chat_sessions_shop_id ON chat_sessions (shop_id);

-- ── chat_messages ────────────────────────────────────────────
CREATE TABLE chat_messages (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id  UUID        NOT NULL REFERENCES chat_sessions (id) ON DELETE CASCADE,
    role        VARCHAR(10) NOT NULL,
    type        VARCHAR(10) NOT NULL DEFAULT 'text',
    content     TEXT        NOT NULL,
    media_url   TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chat_messages_role_check CHECK (role IN ('user','assistant')),
    CONSTRAINT chat_messages_type_check CHECK (type IN ('text','voice','image'))
);

CREATE INDEX idx_chat_messages_session_id  ON chat_messages (session_id);
CREATE INDEX idx_chat_messages_created_at  ON chat_messages (session_id, created_at);

-- ── alerts ───────────────────────────────────────────────────
CREATE TABLE alerts (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    shop_id     UUID        NOT NULL REFERENCES shops (id) ON DELETE CASCADE,
    type        VARCHAR(50) NOT NULL,
    status      VARCHAR(20) NOT NULL DEFAULT 'active',
    message     TEXT        NOT NULL,
    metadata    JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT alerts_type_check CHECK (
        type IN ('low_cash','high_payable','overdue_receivable','duplicate','anomaly')
    ),
    CONSTRAINT alerts_status_check CHECK (
        status IN ('active','acknowledged','dismissed')
    )
);

CREATE INDEX idx_alerts_user_id ON alerts (user_id);
CREATE INDEX idx_alerts_shop_id ON alerts (shop_id);
CREATE INDEX idx_alerts_status  ON alerts (status);
CREATE INDEX idx_alerts_type    ON alerts (type);

-- ── alert_history ────────────────────────────────────────────
CREATE TABLE alert_history (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id      UUID        NOT NULL REFERENCES alerts (id) ON DELETE CASCADE,
    channel       VARCHAR(20) NOT NULL,
    status        VARCHAR(20) NOT NULL,
    delivered_at  TIMESTAMPTZ,
    error_message TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT alert_history_channel_check CHECK (
        channel IN ('email','sms','whatsapp','in_app')
    ),
    CONSTRAINT alert_history_status_check CHECK (
        status IN ('sent','failed','skipped')
    )
);

CREATE INDEX idx_alert_history_alert_id ON alert_history (alert_id);

-- ── updated_at triggers ──────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_shops_updated_at
    BEFORE UPDATE ON shops
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_transactions_updated_at
    BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_alerts_updated_at
    BEFORE UPDATE ON alerts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_excel_imports_updated_at
    BEFORE UPDATE ON excel_imports
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
