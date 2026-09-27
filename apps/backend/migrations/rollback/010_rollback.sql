-- ============================================================
-- Rollback 010: drop password reset links
-- ============================================================
-- Reset links already sent stop working. Passwords already changed stay changed.
-- ============================================================

BEGIN;

DROP TABLE IF EXISTS password_reset_tokens;

COMMIT;
