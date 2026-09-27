-- ============================================================
-- Migration 006: stock tracking (products, stock movements, low-stock alerts)
-- ============================================================
-- Each product has a quantity on hand. Every change to it is a row in
-- stock_movements, so the history can always be explained:
--   opening    — what was on the shelf when the product was added
--   restock    — bought more (optionally linked to the expense/bill that paid for it)
--   sale       — sold (linked to the sale/credit sale)
--   count      — a shelf count: the difference between what the records said
--                and what was actually counted (e.g. 2 missing)
--   adjustment — damaged, expired, used in the shop, given away…
--
-- products.quantity is always the sum of its movements; a trigger keeps it in
-- step, including when a sale is deleted and its movements go with it.
--
-- A product whose quantity falls to its low_stock_level raises one 'low_stock'
-- alert; restocking above the level marks that alert 'resolved'.
-- Run: psql $DATABASE_URL -f migrations/006_stock.sql
-- ============================================================

BEGIN;

CREATE TABLE products (
    id               UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id          UUID           NOT NULL REFERENCES shops (id) ON DELETE CASCADE,
    user_id          UUID           NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name             VARCHAR(200)   NOT NULL,
    unit             VARCHAR(30)    NOT NULL DEFAULT 'piece',
    quantity         NUMERIC(12,2)  NOT NULL DEFAULT 0,
    low_stock_level  NUMERIC(12,2),
    cost_price       DECIMAL(15,2),
    selling_price    DECIMAL(15,2),
    low_alert_id     UUID           REFERENCES alerts (id) ON DELETE SET NULL,
    archived_at      TIMESTAMPTZ,
    created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

    CONSTRAINT products_name_not_blank CHECK (length(trim(name)) > 0),
    CONSTRAINT products_low_level_check CHECK (low_stock_level IS NULL OR low_stock_level >= 0),
    CONSTRAINT products_cost_check CHECK (cost_price IS NULL OR cost_price >= 0),
    CONSTRAINT products_price_check CHECK (selling_price IS NULL OR selling_price >= 0)
);

-- One live product per name in a shop ("Rice" and "rice" are the same product).
CREATE UNIQUE INDEX idx_products_shop_name ON products (shop_id, lower(name)) WHERE archived_at IS NULL;
CREATE INDEX idx_products_shop ON products (shop_id);

CREATE TRIGGER trg_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE stock_movements (
    id              UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      UUID           NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    shop_id         UUID           NOT NULL REFERENCES shops (id) ON DELETE CASCADE,
    user_id         UUID           NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    kind            VARCHAR(20)    NOT NULL,
    change          NUMERIC(12,2)  NOT NULL,
    -- For a shelf count: the quantity actually counted.
    counted         NUMERIC(12,2),
    transaction_id  UUID           REFERENCES transactions (id) ON DELETE CASCADE,
    note            TEXT,
    occurred_on     DATE           NOT NULL,
    created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

    CONSTRAINT stock_movements_kind_check CHECK (
        kind IN ('opening', 'restock', 'sale', 'count', 'adjustment')
    ),
    CONSTRAINT stock_movements_count_check CHECK ((kind = 'count') = (counted IS NOT NULL)),
    CONSTRAINT stock_movements_sale_out CHECK (kind <> 'sale' OR change < 0),
    CONSTRAINT stock_movements_restock_in CHECK (kind <> 'restock' OR change > 0)
);

CREATE INDEX idx_stock_movements_product ON stock_movements (product_id, occurred_on, created_at);
CREATE INDEX idx_stock_movements_shop_date ON stock_movements (shop_id, occurred_on);
CREATE INDEX idx_stock_movements_transaction ON stock_movements (transaction_id) WHERE transaction_id IS NOT NULL;

-- Keeps products.quantity equal to the sum of its movements.
CREATE OR REPLACE FUNCTION apply_stock_movement()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        UPDATE products SET quantity = quantity + NEW.change WHERE id = NEW.product_id;
    END IF;
    IF TG_OP IN ('DELETE', 'UPDATE') THEN
        UPDATE products SET quantity = quantity - OLD.change WHERE id = OLD.product_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_stock_movements_apply
    AFTER INSERT OR UPDATE OF change, product_id OR DELETE ON stock_movements
    FOR EACH ROW EXECUTE FUNCTION apply_stock_movement();

-- Low-stock alerts, and a status for alerts the app closes itself.
ALTER TABLE alerts DROP CONSTRAINT alerts_type_check;
ALTER TABLE alerts ADD CONSTRAINT alerts_type_check CHECK (
    type IN ('low_cash','high_payable','overdue_receivable','duplicate','anomaly','low_stock')
);
ALTER TABLE alerts DROP CONSTRAINT alerts_status_check;
ALTER TABLE alerts ADD CONSTRAINT alerts_status_check CHECK (
    status IN ('active','acknowledged','dismissed','resolved')
);

COMMIT;
