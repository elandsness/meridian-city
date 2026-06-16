CREATE SCHEMA IF NOT EXISTS commerce;

CREATE TABLE commerce.products (
    id VARCHAR(50) PRIMARY KEY,
    sku VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    price_cents INTEGER NOT NULL,
    image_key VARCHAR(50),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE commerce.carts (
    id VARCHAR(50) PRIMARY KEY,
    citizen_id VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_carts_citizen ON commerce.carts(citizen_id);

CREATE TABLE commerce.cart_items (
    id BIGSERIAL PRIMARY KEY,
    cart_id VARCHAR(50) NOT NULL REFERENCES commerce.carts(id),
    product_id VARCHAR(50) NOT NULL REFERENCES commerce.products(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price_cents INTEGER NOT NULL
);
CREATE INDEX idx_cart_items_cart ON commerce.cart_items(cart_id);

CREATE TABLE commerce.orders (
    id VARCHAR(50) PRIMARY KEY,
    citizen_id VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'placed',
    total_cents INTEGER NOT NULL,
    item_count INTEGER NOT NULL DEFAULT 0,
    placed_at TIMESTAMPTZ,
    packed_at TIMESTAMPTZ,
    shipped_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    next_transition_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_orders_citizen ON commerce.orders(citizen_id);
CREATE INDEX idx_orders_next_transition ON commerce.orders(next_transition_at);

CREATE TABLE commerce.order_items (
    id BIGSERIAL PRIMARY KEY,
    order_id VARCHAR(50) NOT NULL REFERENCES commerce.orders(id),
    product_id VARCHAR(50) NOT NULL,
    product_name VARCHAR(150) NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price_cents INTEGER NOT NULL
);
CREATE INDEX idx_order_items_order ON commerce.order_items(order_id);

INSERT INTO commerce.products (id, sku, name, description, price_cents, image_key, active) VALUES
  ('prd-mug',     'MUG-001', 'Meridian mug',         'Start your morning with Meridian City pride.', 1400, 'mug',     TRUE),
  ('prd-tee',     'TEE-001', 'City t-shirt',         'Soft cotton tee with the Meridian skyline.',   2400, 'tee',     TRUE),
  ('prd-sticker', 'STK-001', 'Bumper sticker',       'Show your civic spirit on the go.',             500, 'sticker', TRUE),
  ('prd-dog',     'DOG-001', 'Sweater for your dog', 'Keep your best friend warm and stylish.',      2800, 'dog',     TRUE);
