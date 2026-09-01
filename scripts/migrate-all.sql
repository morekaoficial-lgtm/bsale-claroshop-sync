-- ============================================================
-- Migración Completa: Sincronizar DB con Modelos Sequelize
-- Fecha: 2026-09-02
-- Ejecutar: docker compose exec postgres psql -U bcsync -d bsale_claroshop -f /scripts/migrate-all.sql
-- ============================================================

-- 1. APP_CONFIGS: Agregar description y updated_at
ALTER TABLE app_configs
    ADD COLUMN IF NOT EXISTS description VARCHAR(255),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- 2. PRODUCT_MAPPINGS: Agregar columnas faltantes
ALTER TABLE product_mappings
    ADD COLUMN IF NOT EXISTS images TEXT[],
    ADD COLUMN IF NOT EXISTS category_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS brand VARCHAR(100),
    ADD COLUMN IF NOT EXISTS offer_price DECIMAL(12, 2);

-- 3. SYNC_LOGS: Agregar updated_at (Sequelize lo espera por defecto)
ALTER TABLE sync_logs
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- 4. ORDERS: Agregar updated_at si falta
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- 5. STOCK_CHANGES: Agregar updated_at si falta
ALTER TABLE stock_changes
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- 6. Crear índices faltantes
CREATE INDEX IF NOT EXISTS idx_product_mapping_last_sync ON product_mappings(last_sync_at);

-- 7. Actualizar triggers para updated_at automático (opcional pero recomendado)
-- Creamos una función genérica si no existe
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Aplicar trigger a tablas que necesitan updated_at automático
DROP TRIGGER IF EXISTS update_app_configs_updated_at ON app_configs;
CREATE TRIGGER update_app_configs_updated_at
    BEFORE UPDATE ON app_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_product_mappings_updated_at ON product_mappings;
CREATE TRIGGER update_product_mappings_updated_at
    BEFORE UPDATE ON product_mappings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_stock_changes_updated_at ON stock_changes;
CREATE TRIGGER update_stock_changes_updated_at
    BEFORE UPDATE ON stock_changes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Verificación: mostrar estructura de tablas
\echo '=== Estructura de product_mappings ==='
\d product_mappings
\echo '=== Estructura de app_configs ==='
\d app_configs
\echo '=== Estructura de sync_logs ==='
\d sync_logs
\echo '=== Estructura de orders ==='
\d orders
\echo '=== Estructura de stock_changes ==='
\d stock_changes
