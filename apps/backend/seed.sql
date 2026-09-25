-- ============================================================
-- Seed data: demo shop + sample transactions for testing
-- ============================================================
-- Run AFTER 001_initial.sql:
--   psql $DATABASE_URL -f seed.sql
-- ============================================================

BEGIN;

-- ── Demo user ────────────────────────────────────────────────
-- Password: DemoPass1! (bcrypt hash below is a placeholder — regenerate before use)
INSERT INTO users (
    id, name, email, phone, password_hash,
    email_verified, alert_email, alert_sms,
    threshold_low_cash, threshold_high_payable, threshold_overdue_days
) VALUES (
    'aaaaaaaa-0000-4000-a000-000000000001',
    'Amara Osei',
    'demo@bookkeepingagent.com',
    '+2348012345678',
    '$2b$12$PLACEHOLDER_HASH_REPLACE_BEFORE_USE',
    true, true, false,
    10000, 50000, 30
);

-- ── Demo shops ───────────────────────────────────────────────
INSERT INTO shops (id, owner_id, name, type, location, currency) VALUES
    (
        'bbbbbbbb-0000-4000-b000-000000000001',
        'aaaaaaaa-0000-4000-a000-000000000001',
        'Amara Provisions',
        'retail',
        'Oshodi Market, Lagos',
        'NGN'
    ),
    (
        'bbbbbbbb-0000-4000-b000-000000000002',
        'aaaaaaaa-0000-4000-a000-000000000001',
        'Amara Wholesale',
        'wholesale',
        'Trade Fair, Lagos',
        'NGN'
    );

-- ── Sample transactions (Shop 1 — retail) ────────────────────
INSERT INTO transactions (
    shop_id, user_id, type, amount, currency,
    description, category, counterparty, date, status, ai_categorized
) VALUES
    -- Sales
    ('bbbbbbbb-0000-4000-b000-000000000001','aaaaaaaa-0000-4000-a000-000000000001',
     'sale', 8000.00, 'NGN', 'Sold 10 bags of rice (50kg)', 'Food & Beverages',
     'Chukwu Market', '2024-01-10', 'settled', false),

    ('bbbbbbbb-0000-4000-b000-000000000001','aaaaaaaa-0000-4000-a000-000000000001',
     'sale', 3500.00, 'NGN', 'Sold cooking oil (12 bottles)', 'Food & Beverages',
     'Mrs. Bello', '2024-01-12', 'settled', false),

    ('bbbbbbbb-0000-4000-b000-000000000001','aaaaaaaa-0000-4000-a000-000000000001',
     'sale', 1200.00, 'NGN', 'Sold assorted drinks', 'Food & Beverages',
     'Walk-in customer', '2024-01-15', 'settled', true),

    ('bbbbbbbb-0000-4000-b000-000000000001','aaaaaaaa-0000-4000-a000-000000000001',
     'sale', 15000.00, 'NGN', 'Bulk sale — flour and sugar', 'Food & Beverages',
     'Sunrise Bakery', '2024-01-18', 'settled', false),

    -- Expenses
    ('bbbbbbbb-0000-4000-b000-000000000001','aaaaaaaa-0000-4000-a000-000000000001',
     'expense', 45000.00, 'NGN', 'Restocked rice (30 bags)', 'Inventory — Food',
     'Dangote Flour Mills', '2024-01-05', 'settled', false),

    ('bbbbbbbb-0000-4000-b000-000000000001','aaaaaaaa-0000-4000-a000-000000000001',
     'expense', 5000.00, 'NGN', 'Shop rent — January', 'Rent & Utilities',
     'Alhaji Musa (Landlord)', '2024-01-01', 'settled', false),

    ('bbbbbbbb-0000-4000-b000-000000000001','aaaaaaaa-0000-4000-a000-000000000001',
     'expense', 1500.00, 'NGN', 'Generator fuel', 'Utilities',
     'Filling station', '2024-01-08', 'settled', true),

    ('bbbbbbbb-0000-4000-b000-000000000001','aaaaaaaa-0000-4000-a000-000000000001',
     'expense', 800.00, 'NGN', 'Shop supplies (bags, labels)', 'Supplies',
     'Balogun Market', '2024-01-14', 'settled', true),

    -- Receivables (credit sales)
    ('bbbbbbbb-0000-4000-b000-000000000001','aaaaaaaa-0000-4000-a000-000000000001',
     'receivable', 12000.00, 'NGN', 'Credit sale — 15 bags rice', 'Food & Beverages',
     'Mama Ngozi Restaurant', '2024-01-16', 'pending', false),

    ('bbbbbbbb-0000-4000-b000-000000000001','aaaaaaaa-0000-4000-a000-000000000001',
     'receivable', 4500.00, 'NGN', 'Credit — drinks and snacks', 'Food & Beverages',
     'Kelechi Events', '2023-12-20', 'overdue', false),

    -- Payables (supplier credit)
    ('bbbbbbbb-0000-4000-b000-000000000001','aaaaaaaa-0000-4000-a000-000000000001',
     'payable', 22000.00, 'NGN', 'Balance owed — cooking oil restock', 'Inventory — Food',
     'Okonkwo Distributors', '2024-01-10', 'pending', false);

-- ── Sample transactions (Shop 2 — wholesale) ─────────────────
INSERT INTO transactions (
    shop_id, user_id, type, amount, currency,
    description, category, counterparty, date, status, ai_categorized
) VALUES
    ('bbbbbbbb-0000-4000-b000-000000000002','aaaaaaaa-0000-4000-a000-000000000001',
     'sale', 120000.00, 'NGN', 'Bulk order — 200 bags rice', 'Food & Beverages',
     'Sunrise Supermarket Chain', '2024-01-08', 'settled', false),

    ('bbbbbbbb-0000-4000-b000-000000000002','aaaaaaaa-0000-4000-a000-000000000001',
     'expense', 95000.00, 'NGN', 'Warehouse stock replenishment', 'Inventory — Food',
     'Olam Nigeria', '2024-01-03', 'settled', false),

    ('bbbbbbbb-0000-4000-b000-000000000002','aaaaaaaa-0000-4000-a000-000000000001',
     'receivable', 75000.00, 'NGN', 'Credit — 120 bags rice', 'Food & Beverages',
     'Abuja Fresh Markets', '2024-01-15', 'pending', false);

-- ── Demo alert ───────────────────────────────────────────────
INSERT INTO alerts (
    user_id, shop_id, type, status, message, metadata
) VALUES (
    'aaaaaaaa-0000-4000-a000-000000000001',
    'bbbbbbbb-0000-4000-b000-000000000001',
    'overdue_receivable',
    'active',
    'Kelechi Events owes ₦4,500 — overdue since 20 Dec 2023 (36 days)',
    '{"transactionId": null, "amountNGN": 4500, "daysOverdue": 36}'
);

COMMIT;
