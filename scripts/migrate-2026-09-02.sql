-- ============================================================
-- Migración: Agregar columnas faltantes a tablas existentes
-- Fecha: 2026-09-02
-- ============================================================

-- 1. Agregar columnas faltantes a product_mappings
ALTER TABLE product_mappings
    ADD COLUMN IF NOT EXISTS images TEXT[],
    ADD COLUMN IF NOT EXISTS category_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS brand VARCHAR(100),
    ADD COLUMN IF NOT EXISTS offer_price DECIMAL(12, 2);

-- 2. Agregar columna description a app_configs
ALTER TABLE app_configs
    ADD COLUMN IF NOT EXISTS description VARCHAR(255);

-- 3. Crear índices faltantes (si no existen)
CREATE INDEX IF NOT EXISTS idx_product_mapping_last_sync ON product_mappings(last_sync_at);

-- 4. Actualizar init-db.sql para futuras instalaciones (documentado)
-- Nota: images es TEXT[] (array de strings), no VARCHAR
