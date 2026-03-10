-- MIGRATION: Add Store Origin and Store Order ID to Orders Table
-- Goal: Improve platform detection for NF-e and label generation.

-- 1. Add venda_origem column to store raw store name from Bling
ALTER TABLE orders ADD COLUMN IF NOT EXISTS venda_origem TEXT;

-- 2. Add id_pedido_loja column to store the original order ID from the marketplace
ALTER TABLE orders ADD COLUMN IF NOT EXISTS id_pedido_loja TEXT;

-- 3. Add index for faster lookups during NF-e pairing
CREATE INDEX IF NOT EXISTS idx_orders_id_pedido_loja ON orders(id_pedido_loja);
CREATE INDEX IF NOT EXISTS idx_orders_venda_origem ON orders(venda_origem);

COMMENT ON COLUMN orders.venda_origem IS 'Original store/channel name from Bling (e.g. MERCADO LIVRE, SHOPEE)';
COMMENT ON COLUMN orders.id_pedido_loja IS 'Original order number from the marketplace (numeroLoja)';
