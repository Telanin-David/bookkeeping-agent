-- ============================================================
-- Migration 012: what the assistant did, kept with its reply
-- ============================================================
-- The assistant is sent the earlier messages of a chat as plain text.
-- Without the tool calls behind them, it would read its own "Done, I
-- marked Ade as paid", see the books already showing Ade paid, decide
-- someone else made the change, apologise, and do it again.
--
-- chat_messages.actions: one line per change the assistant made while
-- writing the reply ("recorded …", "deleted …", "showed the receipt …").
-- It goes back to the assistant with the history.
--   NULL  a message from before this column (nothing is known)
--   '{}'  the assistant changed nothing
--
-- Run: psql $DATABASE_URL -f migrations/012_chat_actions.sql
-- Rollback: psql $DATABASE_URL -f migrations/rollback/012_rollback.sql
-- ============================================================

BEGIN;

ALTER TABLE chat_messages ADD COLUMN actions TEXT[];

COMMIT;
