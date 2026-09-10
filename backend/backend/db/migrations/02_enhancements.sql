-- 02_enhancements.sql: Non-destructive enhancements for SmartStore POS

-- Ensure a default store exists for single-store setups
INSERT INTO stores (id, name, address, phone)
VALUES (1, 'Main Store', 'Main Branch', '000-000-0000')
ON CONFLICT (id) DO NOTHING;

-- Safely add subtotal and user_id to sales table if missing
ALTER TABLE sales ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12,2) DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS user_id INT REFERENCES users(id) ON DELETE SET NULL;

-- Fast lookup indexes for POS scanning, product search and reporting
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_sales_sale_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(purchase_date);
CREATE INDEX IF NOT EXISTS idx_stock_movements_prod ON stock_movements(product_id);
