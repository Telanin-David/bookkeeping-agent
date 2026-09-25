-- ============================================================
-- Rollback 001: Drop everything created in 001_initial.sql
-- ============================================================
-- Run: psql $DATABASE_URL -f migrations/rollback/001_rollback.sql
-- WARNING: This destroys all data. Use only in dev/staging.
-- ============================================================

BEGIN;

DROP TRIGGER IF EXISTS trg_excel_imports_updated_at ON excel_imports;
DROP TRIGGER IF EXISTS trg_alerts_updated_at        ON alerts;
DROP TRIGGER IF EXISTS trg_transactions_updated_at  ON transactions;
DROP TRIGGER IF EXISTS trg_shops_updated_at         ON shops;
DROP TRIGGER IF EXISTS trg_users_updated_at         ON users;

DROP FUNCTION IF EXISTS set_updated_at();

DROP TABLE IF EXISTS alert_history    CASCADE;
DROP TABLE IF EXISTS alerts           CASCADE;
DROP TABLE IF EXISTS chat_messages    CASCADE;
DROP TABLE IF EXISTS chat_sessions    CASCADE;
DROP TABLE IF EXISTS transactions     CASCADE;
DROP TABLE IF EXISTS excel_imports    CASCADE;
DROP TABLE IF EXISTS shops            CASCADE;
DROP TABLE IF EXISTS users            CASCADE;

DROP EXTENSION IF EXISTS "pgcrypto";

COMMIT;
