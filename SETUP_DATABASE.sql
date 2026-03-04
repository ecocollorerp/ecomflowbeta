-- ==================================================
-- SCRIPT DE SETUP - DADOS INICIAIS
-- ==================================================
-- Execute DEPOIS de rodar db.sql no Supabase SQL Editor

-- ─────────────────────────────────────────────────────
-- 1. USUÁRIO ADMIN (login: admin / supersuecocollor)
-- ─────────────────────────────────────────────────────
INSERT INTO users (name, password, role, setor)
VALUES (
    'admin',
    'supersuecocollor',
    'SUPER_ADMIN',
    ARRAY['ADMINISTRATIVO']
)
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────
-- 2. INSUMOS / MATÉRIAS-PRIMAS (stock_items)
-- ─────────────────────────────────────────────────────
INSERT INTO stock_items (code, name, kind, unit, category, current_qty)
VALUES 
    ('MAT-PAPEL-001', 'Papel A4 80g (resma)', 'INSUMO', 'resmas', 'Papéis', 100),
    ('MAT-TINTA-001', 'Tinta Preta (litro)',  'INSUMO', 'litros', 'Tintas', 50),
    ('MAT-COLA-001',  'Cola PVA (kg)',         'INSUMO', 'kg',     'Adesivos', 25),
    ('MAT-LAM-001',   'Laminado Brilho (m2)',  'INSUMO', 'm2',     'Laminados', 200)
ON CONFLICT (code) DO NOTHING;

-- ─────────────────────────────────────────────────────
-- 3. PRODUTOS FINAIS (product_boms)
-- ─────────────────────────────────────────────────────
INSERT INTO product_boms (id, code, name, kind, unit, category, current_qty, reserved_qty, ready_qty, sell_price, cost_price, bom_composition, items)
VALUES 
    ('prod_001', 'PROD-CARTAZ-001', 'Cartaz A3 Colorido', 'PRODUTO', 'unidades', 'Impressos', 50, 10, 40, 25.50, 12.00,
     '{"items":[{"insumo_code":"MAT-PAPEL-001","insumo_name":"Papel A4 80g (resma)","quantity":0.5,"unit":"resmas"},{"insumo_code":"MAT-TINTA-001","insumo_name":"Tinta Preta (litro)","quantity":0.1,"unit":"litros"},{"insumo_code":"MAT-LAM-001","insumo_name":"Laminado Brilho (m2)","quantity":0.1,"unit":"m2"}]}'::jsonb,
     '[{"insumo_code":"MAT-PAPEL-001","insumo_name":"Papel A4 80g (resma)","quantity":0.5,"unit":"resmas"},{"insumo_code":"MAT-TINTA-001","insumo_name":"Tinta Preta (litro)","quantity":0.1,"unit":"litros"},{"insumo_code":"MAT-LAM-001","insumo_name":"Laminado Brilho (m2)","quantity":0.1,"unit":"m2"}]'::jsonb),
    
    ('prod_002', 'PROD-FOLDER-001', 'Folder A4 Dobrado', 'PRODUTO', 'unidades', 'Impressos', 100, 20, 80, 15.75, 8.50,
     '{"items":[{"insumo_code":"MAT-PAPEL-001","insumo_name":"Papel A4 80g (resma)","quantity":0.3,"unit":"resmas"},{"insumo_code":"MAT-COLA-001","insumo_name":"Cola PVA (kg)","quantity":0.05,"unit":"kg"}]}'::jsonb,
     '[{"insumo_code":"MAT-PAPEL-001","insumo_name":"Papel A4 80g (resma)","quantity":0.3,"unit":"resmas"},{"insumo_code":"MAT-COLA-001","insumo_name":"Cola PVA (kg)","quantity":0.05,"unit":"kg"}]'::jsonb),
    
    ('prod_003', 'PROD-BANNER-001', 'Banner Lona 2x3m', 'PRODUTO', 'unidades', 'Outdoors', 10, 2, 8, 85.00, 40.00,
     '{"items":[{"insumo_code":"MAT-TINTA-001","insumo_name":"Tinta Preta (litro)","quantity":0.5,"unit":"litros"},{"insumo_code":"MAT-LAM-001","insumo_name":"Laminado Brilho (m2)","quantity":6.0,"unit":"m2"}]}'::jsonb,
     '[{"insumo_code":"MAT-TINTA-001","insumo_name":"Tinta Preta (litro)","quantity":0.5,"unit":"litros"},{"insumo_code":"MAT-LAM-001","insumo_name":"Laminado Brilho (m2)","quantity":6.0,"unit":"m2"}]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────
-- 4. SKU LINKS (MARKETPLACE)
-- ─────────────────────────────────────────────────────
INSERT INTO sku_links (imported_sku, master_product_sku)
VALUES 
    ('ML-12345678901', 'PROD-CARTAZ-001'),
    ('ML-87654321098', 'PROD-FOLDER-001'),
    ('ML-11111111111', 'PROD-BANNER-001'),
    ('ML-99999999999', 'PROD-CARTAZ-001')
ON CONFLICT (imported_sku) DO NOTHING;

-- ─────────────────────────────────────────────────────
-- 5. VERIFICAÇÃO
-- ─────────────────────────────────────────────────────
SELECT 
    (SELECT COUNT(*) FROM users)       AS "Usuarios",
    (SELECT COUNT(*) FROM stock_items)  AS "Insumos",
    (SELECT COUNT(*) FROM product_boms) AS "Produtos",
    (SELECT COUNT(*) FROM sku_links)    AS "SKU Links";
