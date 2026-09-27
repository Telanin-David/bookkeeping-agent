-- ============================================================
-- Migration 004: shop receipt branding (logo + signature)
-- ============================================================
-- Deliverable 7. Stores the storage key of each uploaded image (not a URL):
-- the API maps a key to /api/v1/files/branding/<key>, so the files can move
-- (local disk today, object storage later) without rewriting rows.
-- Run: psql $DATABASE_URL -f migrations/004_shop_branding.sql
-- ============================================================

BEGIN;

ALTER TABLE shops
    ADD COLUMN logo_key      VARCHAR(120),
    ADD COLUMN signature_key VARCHAR(120);

COMMIT;
