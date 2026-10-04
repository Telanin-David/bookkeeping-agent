-- ============================================================
-- Migration 002: Link assistant chat messages to transactions
-- ============================================================
-- Run:      psql $DATABASE_URL -f migrations/002_chat_message_links.sql
-- Rollback: psql $DATABASE_URL -f migrations/rollback/002_rollback.sql
-- ============================================================
-- The agent records transactions and resolves receipt requests while
-- answering. Persisting those links lets the client re-render receipt
-- cards and "saved" chips when a session's history is reloaded.

BEGIN;

ALTER TABLE chat_messages
    ADD COLUMN extracted_transaction_ids UUID[] NOT NULL DEFAULT '{}',
    ADD COLUMN receipt_transaction_id    UUID REFERENCES transactions (id) ON DELETE SET NULL;

COMMIT;
