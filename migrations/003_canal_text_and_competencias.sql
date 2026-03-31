-- ============================================================================
-- MIGRAÇÃO 003 — Canal TEXT + Suporte Competências Múltiplas
-- Data: 2026-03-31
-- Idempotente: pode ser executada múltiplas vezes com segurança.
--
-- Alterações:
--   1. orders.canal: canal_type ENUM → TEXT (suporta TIKTOK, custom stores)
--   2. canal_type ENUM: expandido com TIKTOK (para retrocompat.)
--   3. Índice parcial para performance de queries por canal
--   4. Drop/recreate views que dependem de orders.canal
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Expandir ENUM com TIKTOK (caso alguma VIEW ou RPC dependa do tipo)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
    ALTER TYPE canal_type ADD VALUE IF NOT EXISTS 'TIKTOK';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TYPE canal_type ADD VALUE IF NOT EXISTS 'AUTO';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Dropar TODAS as views que dependem de orders.canal
--    (sem isso o ALTER TYPE falha com "cannot alter type used by a view")
-- ─────────────────────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS v_orders_status CASCADE;
DROP VIEW IF EXISTS vw_dados_analiticos CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Converter orders.canal de canal_type ENUM para TEXT
--    Isso permite canais customizados dinâmicos (customStores)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
    -- Só converte se a coluna ainda for do tipo canal_type (enum)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'orders'
          AND column_name = 'canal'
          AND udt_name = 'canal_type'
    ) THEN
        ALTER TABLE orders ALTER COLUMN canal TYPE TEXT USING canal::TEXT;
        RAISE NOTICE 'orders.canal convertido de canal_type para TEXT';
    ELSE
        RAISE NOTICE 'orders.canal já é TEXT — nada a fazer';
    END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Recriar índice de canal (agora sobre TEXT)
-- ─────────────────────────────────────────────────────────────────────────────
DROP INDEX IF EXISTS idx_orders_canal;
CREATE INDEX IF NOT EXISTS idx_orders_canal ON orders (canal);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Recriar vw_dados_analiticos (agora canal é TEXT)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW vw_dados_analiticos AS
SELECT
    o.id                                  AS id_pedido,
    o.order_id                            AS codigo_pedido,
    o.data                                AS data_pedido,
    o.canal,
    o.status                              AS status_pedido,
    COALESCE(sl_link.master_product_sku, o.sku) AS sku_mestre,
    COALESCE(si.name, pb.name, o.sku)     AS nome_produto,
    o.qty_final                           AS quantidade_final,
    COALESCE(sc.user_name, '')            AS bipado_por,
    COALESCE(sc.user_id, '')              AS bipado_por_id,
    sc.scanned_at                         AS data_bipagem,
    o.venda_origem                        AS canal_real,
    o.id_pedido_loja                      AS num_loja_virtual,
    CASE
        WHEN o.status::text = 'BIPADO' AND sc.scanned_at IS NOT NULL
             AND o.data IS NOT NULL AND o.data ~ '^\d{4}-\d{2}-\d{2}'
             AND TO_DATE(o.data, 'YYYY-MM-DD') < DATE(sc.scanned_at)
        THEN 'Bipado com Atraso'
        WHEN o.status::text = 'BIPADO'      THEN 'Bipado no Prazo'
        WHEN o.status::text = 'DEVOLVIDO'   THEN 'Devolvido'
        WHEN o.status::text = 'SOLUCIONADO' THEN 'Solucionado'
        WHEN o.status::text = 'ERRO'        THEN 'Com Erro'
        WHEN o.status::text = 'NORMAL' AND o.data IS NOT NULL
             AND o.data ~ '^\d{4}-\d{2}-\d{2}'
             AND TO_DATE(o.data, 'YYYY-MM-DD') < CURRENT_DATE
        THEN 'Atrasado'
        WHEN o.status::text = 'NORMAL'      THEN 'Pendente'
        ELSE o.status::text
    END                                   AS status_derivado,
    CASE
        WHEN sc.scanned_at IS NOT NULL AND o.data IS NOT NULL AND o.data ~ '^\d{4}-\d{2}-\d{2}'
        THEN EXTRACT(EPOCH FROM (sc.scanned_at - (TO_DATE(o.data,'YYYY-MM-DD') + INTERVAL '12 hours'))) / 3600.0
        ELSE NULL
    END                                   AS tempo_separacao_horas
FROM orders o
LEFT JOIN sku_links sl_link ON sl_link.imported_sku = o.sku
LEFT JOIN stock_items si ON si.code = COALESCE(sl_link.master_product_sku, o.sku)
LEFT JOIN product_boms pb ON pb.code = COALESCE(sl_link.master_product_sku, o.sku)
LEFT JOIN LATERAL (
    SELECT user_name, user_id, scanned_at
    FROM scan_logs
    WHERE (display_key = o.order_id OR display_key = o.tracking)
      AND status = 'OK'
    ORDER BY scanned_at DESC
    LIMIT 1
) sc ON TRUE;

-- ─────────────────────────────────────────────────────────────────────────────
-- NOTA: A view v_orders_status existia no Supabase mas não está no schema
-- local. Se ela for necessária, recrie-a manualmente no SQL Editor do Supabase.
-- Para ver a definição original antes do DROP, use:
--   SELECT pg_get_viewdef('v_orders_status', true);
-- ─────────────────────────────────────────────────────────────────────────────

-- Migração concluída.
