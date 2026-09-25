-- ============================================================
-- Migration 002: chat message ↔ transaction linkage
-- ============================================================
-- Deliverable 5 (Claude integration) needs a chat message to record which
-- transactions it caused the agent to create, and — for a "give me a
-- receipt for X" reply — which existing transaction it is presenting.
-- Run: psql $DATABASE_URL -f migrations/002_chat_extraction.sql
-- ============================================================

BEGIN;

ALTER TABLE chat_messages
    ADD COLUMN extracted_transaction_ids UUID[] NOT NULL DEFAULT '{}',
    ADD COLUMN receipt_transaction_id    UUID REFERENCES transactions (id) ON DELETE SET NULL;

COMMIT;
