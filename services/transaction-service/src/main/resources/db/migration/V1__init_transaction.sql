CREATE SCHEMA IF NOT EXISTS transaction;

-- Orders (from checkout)
CREATE TABLE IF NOT EXISTS transaction.orders (
    id VARCHAR(50) PRIMARY KEY,
    identity_id VARCHAR(50) NOT NULL,
    cart_id VARCHAR(50) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'placed',
    total_cents INTEGER NOT NULL,
    item_count INTEGER NOT NULL,
    placed_at TIMESTAMPTZ,
    packed_at TIMESTAMPTZ,
    shipped_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    next_transition_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_orders_identity ON transaction.orders(identity_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON transaction.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_lifecycle ON transaction.orders(next_transition_at) WHERE status <> 'delivered';

-- Cart items
CREATE TABLE IF NOT EXISTS transaction.cart_items (
    id VARCHAR(50) PRIMARY KEY,
    cart_id VARCHAR(50) NOT NULL,
    product_id VARCHAR(50) NOT NULL,
    product_name VARCHAR(255),
    quantity INTEGER NOT NULL,
    unit_price_cents INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart ON transaction.cart_items(cart_id);

-- Orders
CREATE TABLE IF NOT EXISTS transaction.carts (
    id VARCHAR(50) PRIMARY KEY,
    identity_id VARCHAR(50) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'open',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_carts_identity ON transaction.carts(identity_id, status);

-- Order items
CREATE TABLE IF NOT EXISTS transaction.order_items (
    id VARCHAR(50) PRIMARY KEY,
    order_id VARCHAR(50) NOT NULL,
    product_id VARCHAR(50) NOT NULL,
    product_name VARCHAR(255),
    quantity INTEGER NOT NULL,
    unit_price_cents INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON transaction.order_items(order_id);

-- Bills (tax bills, regulatory fees, etc.)
CREATE TABLE IF NOT EXISTS transaction.bills (
    id VARCHAR(50) PRIMARY KEY,
    identity_id VARCHAR(50) NOT NULL,
    period VARCHAR(20) NOT NULL,
    amount_cents INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'outstanding',
    issued_at TIMESTAMPTZ,
    due_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bills_identity ON transaction.bills(identity_id);
CREATE INDEX IF NOT EXISTS idx_bills_status ON transaction.bills(status);

-- Payments
CREATE TABLE IF NOT EXISTS transaction.payments (
    id VARCHAR(50) PRIMARY KEY,
    identity_id VARCHAR(50) NOT NULL,
    bill_id VARCHAR(50) NOT NULL,
    amount_cents INTEGER NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'completed',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payments_bill ON transaction.payments(bill_id);
