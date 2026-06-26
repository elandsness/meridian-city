-- Carry the originating cart id onto the order so the City Store Purchase business
-- flow can correlate cart.item_added -> checkout.completed -> order.packed/shipped/
-- delivered on a single key (cart.id). Nullable: orders placed before this migration
-- have no associated cart.
ALTER TABLE commerce.orders ADD COLUMN IF NOT EXISTS cart_id VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_orders_cart ON commerce.orders(cart_id);
