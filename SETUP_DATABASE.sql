-- ==================================================
-- SCRIPT DE SETUP COMPLETO DO BANCO
-- ==================================================
-- Execute este script no Supabase SQL Editor quando estiver pronto

-- 1️⃣ PRIMEIRO: Execute a migration completa
-- Copie todo o conteúdo de MIGRATION_FINAL_UPDATED.sql e execute antes deste

-- 2️⃣ DEPOIS: Limpe tabelas antigas (se existirem)
DROP TABLE IF EXISTS old_boms CASCADE;
DROP TABLE IF EXISTS old_products CASCADE;

-- 3️⃣ DEPOIS: Insira dados de teste

-- ===== DADOS DE TESTE: INSUMOS/MATÉRIAS-PRIMAS =====
INSERT INTO stock_items (id, code, name, kind, unit, category, current_qty, reserved_qty, created_at, updated_at)
VALUES 
    ('mat_001_papel', 'MAT-PAPEL-001', 'Papel A4 80g (resma)', 'INSUMO', 'resmas', 'Papéis', 100.00, 0, (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000), (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000)),
    ('mat_002_tinta', 'MAT-TINTA-001', 'Tinta Preta (litro)', 'INSUMO', 'litros', 'Tintas', 50.00, 0, (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000), (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000)),
    ('mat_003_cola', 'MAT-COLA-001', 'Cola PVA (kg)', 'INSUMO', 'kg', 'Adesivos', 25.00, 0, (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000), (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000)),
    ('mat_004_laminado', 'MAT-LAM-001', 'Laminado Brilho (m2)', 'INSUMO', 'm2', 'Laminados', 200.00, 0, (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000), (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000))
ON CONFLICT (id) DO NOTHING;

-- ===== DADOS DE TESTE: PRODUTOS FINAIS =====
INSERT INTO product_boms (id, code, name, kind, unit, category, current_qty, reserved_qty, ready_qty, price, cost, created_at, updated_at, bom_composition)
VALUES 
    ('prod_001_cartaz', 'PROD-CARTAZ-001', 'Cartaz A3 Colorido', 'PRODUTO', 'unidades', 'Impressos', 50.00, 10.00, 40.00, 25.50, 12.00, (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000), (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
     '{"items": [
        {"insumo_code": "MAT-PAPEL-001", "insumo_name": "Papel A4 80g (resma)", "quantity": 0.5, "unit": "resmas"},
        {"insumo_code": "MAT-TINTA-001", "insumo_name": "Tinta Preta (litro)", "quantity": 0.1, "unit": "litros"},
        {"insumo_code": "MAT-LAM-001", "insumo_name": "Laminado Brilho (m2)", "quantity": 0.1, "unit": "m2"}
     ]}'::jsonb),
    
    ('prod_002_folder', 'PROD-FOLDER-001', 'Folder A4 Dobrado', 'PRODUTO', 'unidades', 'Impressos', 100.00, 20.00, 80.00, 15.75, 8.50, (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000), (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
     '{"items": [
        {"insumo_code": "MAT-PAPEL-001", "insumo_name": "Papel A4 80g (resma)", "quantity": 0.3, "unit": "resmas"},
        {"insumo_code": "MAT-COLA-001", "insumo_name": "Cola PVA (kg)", "quantity": 0.05, "unit": "kg"}
     ]}'::jsonb),
    
    ('prod_003_banner', 'PROD-BANNER-001', 'Banner Lona 2x3m', 'PRODUTO', 'unidades', 'Outdoors', 10.00, 2.00, 8.00, 85.00, 40.00, (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000), (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
     '{"items": [
        {"insumo_code": "MAT-TINTA-001", "insumo_name": "Tinta Preta (litro)", "quantity": 0.5, "unit": "litros"},
        {"insumo_code": "MAT-LAM-001", "insumo_name": "Laminado Brilho (m2)", "quantity": 6.0, "unit": "m2"}
     ]}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ===== DADOS DE TESTE: SKU LINKS (MARKETPLACE) =====
INSERT INTO sku_links (imported_sku, master_product_sku, product_code, imported_at, matched_at)
VALUES 
    ('ML-12345678901', 'PROD-CARTAZ-001', 'PROD-CARTAZ-001', NOW(), NOW()),
    ('ML-87654321098', 'PROD-FOLDER-001', 'PROD-FOLDER-001', NOW(), NOW()),
    ('ML-11111111111', 'PROD-BANNER-001', 'PROD-BANNER-001', NOW(), NOW()),
    ('ML-99999999999', 'PROD-CARTAZ-001', 'PROD-CARTAZ-001', NOW(), NOW())
ON CONFLICT (imported_sku) DO NOTHING;

-- ===== VERIFICAÇÃO: Query para confirmar dados =====
-- Após executar, você verá:
-- ✅ 4 insumos carregados em stock_items
-- ✅ 3 produtos finais em product_boms
-- ✅ 4 SKUs linkeados em sku_links

SELECT 
    (SELECT COUNT(*) FROM stock_items) as "Insumos Carregados",
    (SELECT COUNT(*) FROM product_boms) as "Produtos Finais",
    (SELECT COUNT(*) FROM sku_links) as "SKUs Linkados";
