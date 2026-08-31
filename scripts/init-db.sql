-- ============================================================
-- Init DB Script for Bsale ↔ Claro Shop Sync
-- Run: psql -U postgres -d bsale_claro_sync -f scripts/init-db.sql
-- ============================================================

-- Product Mappings
CREATE TABLE IF NOT EXISTS product_mappings (
    id SERIAL PRIMARY KEY,
    bsale_product_id INTEGER NOT NULL,
    bsale_variant_id INTEGER NOT NULL UNIQUE,
    claroshop_product_id VARCHAR(100),
    bsale_sku VARCHAR(100),
    claroshop_sku VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(500),
    description TEXT,
    price DECIMAL(12, 2),
    stock INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending',
    sync_error TEXT,
    last_sync_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_product_mapping_status ON product_mappings(status);
CREATE INDEX IF NOT EXISTS idx_product_mapping_bsale_variant ON product_mappings(bsale_variant_id);
CREATE INDEX IF NOT EXISTS idx_product_mapping_claroshop_sku ON product_mappings(claroshop_sku);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    claroshop_order_id VARCHAR(100) NOT NULL UNIQUE,
    bsale_document_id INTEGER,
    bsale_document_number VARCHAR(100),
    bsale_status VARCHAR(50),
    customer_name VARCHAR(255),
    customer_email VARCHAR(255),
    customer_phone VARCHAR(50),
    shipping_address JSONB,
    total DECIMAL(12, 2) DEFAULT 0,
    shipping_cost DECIMAL(12, 2) DEFAULT 0,
    discount DECIMAL(12, 2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'pending',
    claroshop_status VARCHAR(50),
    sync_error TEXT,
    items JSONB DEFAULT '[]',
    imported_at TIMESTAMP,
    processed_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_order_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_claroshop ON orders(claroshop_order_id);
CREATE INDEX IF NOT EXISTS idx_order_imported ON orders(imported_at);

-- Sync Logs
CREATE TABLE IF NOT EXISTS sync_logs (
    id SERIAL PRIMARY KEY,
    sync_type VARCHAR(50) NOT NULL,
    direction VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100),
    entity_type VARCHAR(50),
    status VARCHAR(20) NOT NULL,
    message TEXT,
    error_detail TEXT,
    request_payload JSONB,
    response_payload JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_type ON sync_logs(sync_type);
CREATE INDEX IF NOT EXISTS idx_sync_logs_status ON sync_logs(status);
CREATE INDEX IF NOT EXISTS idx_sync_logs_created ON sync_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_sync_logs_entity ON sync_logs(entity_id);

-- Stock Changes
CREATE TABLE IF NOT EXISTS stock_changes (
    id SERIAL PRIMARY KEY,
    bsale_variant_id INTEGER NOT NULL,
    bsale_office_id INTEGER NOT NULL,
    old_stock INTEGER DEFAULT 0,
    new_stock INTEGER NOT NULL,
    change_reason VARCHAR(50) DEFAULT 'sync',
    synced_to_claroshop BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stock_changes_variant ON stock_changes(bsale_variant_id);
CREATE INDEX IF NOT EXISTS idx_stock_changes_synced ON stock_changes(synced_to_claroshop);
CREATE INDEX IF NOT EXISTS idx_stock_changes_created ON stock_changes(created_at);

-- App Config
CREATE TABLE IF NOT EXISTS app_configs (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) NOT NULL UNIQUE,
    value TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default configs
INSERT INTO app_configs (key, value) VALUES
    ('sync.interval_minutes', '15'),
    ('sync.products.enabled', 'true'),
    ('sync.stock.enabled', 'true'),
    ('sync.orders.enabled', 'true'),
    ('bsale.price_list_id', '1'),
    ('bsale.office_id', '1'),
    ('bsale.document_type_id', '1'),
    ('claroshop.shipping_time_days', '3'),
    ('notifications.telegram.enabled', 'false'),
    ('notifications.email.enabled', 'false')
ON CONFLICT (key) DO NOTHING;
