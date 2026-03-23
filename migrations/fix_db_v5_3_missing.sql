-- =============================================================================
-- MIGRAÇÃO: fix_db_v5_3_missing.sql
-- Corrige os itens quebrados/ausentes no banco Supabase v5.3
--
-- COMO USAR:
--   1. Acesse https://supabase.com/dashboard/project/uafsmsiwaxopxznupuqw
--   2. Vá em "SQL Editor"
--   3. Cole este arquivo inteiro e clique em "Run"
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. CRIAR TABELA etiquetas_prioritarias (estava faltando no banco)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.etiquetas_prioritarias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id TEXT NOT NULL,
  numero_bling TEXT NOT NULL,
  nfe_lote TEXT NOT NULL,
  data_geracao TIMESTAMPTZ DEFAULT now(),
  status_processamento TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status_processamento IN ('pendente', 'processando', 'concluido', 'salvo_no_pc', 'erro')),
  armazenagem TEXT NOT NULL DEFAULT 'zpl'
    CHECK (armazenagem IN ('zpl', 'pc')),
  conteudo_zpl TEXT,
  conteudo_txt TEXT,
  caminho_arquivo TEXT,
  rastreabilidade JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadados JSONB DEFAULT '{}'::jsonb,
  criado_por TEXT,
  atualizado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_por TEXT,
  CONSTRAINT etiquetas_prioritarias_num_nfe_uq UNIQUE (numero_bling, nfe_lote)
);

CREATE INDEX IF NOT EXISTS idx_etiquetas_nfe_lote    ON public.etiquetas_prioritarias(nfe_lote);
CREATE INDEX IF NOT EXISTS idx_etiquetas_num_bling   ON public.etiquetas_prioritarias(numero_bling);
CREATE INDEX IF NOT EXISTS idx_etiquetas_pedido_id   ON public.etiquetas_prioritarias(pedido_id);
CREATE INDEX IF NOT EXISTS idx_etiquetas_status      ON public.etiquetas_prioritarias(status_processamento);

-- Habilitar RLS com policy aberta (igual ao padrão das outras tabelas)
ALTER TABLE public.etiquetas_prioritarias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all" ON public.etiquetas_prioritarias;
CREATE POLICY "allow_all" ON public.etiquetas_prioritarias
  FOR ALL USING (true) WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. GARANTIR COLUNAS FALTANTES EM stock_pack_groups e estoque_pronto
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.stock_pack_groups ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'tradicional';
ALTER TABLE public.stock_pack_groups ADD COLUMN IF NOT EXISTS quantidade_volatil NUMERIC DEFAULT 0;
ALTER TABLE public.stock_pack_groups ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE public.stock_pack_groups ADD COLUMN IF NOT EXISTS final_product_code TEXT;
ALTER TABLE public.stock_pack_groups ADD COLUMN IF NOT EXISTS localizacao TEXT;
ALTER TABLE public.stock_pack_groups ADD COLUMN IF NOT EXISTS pallet TEXT;
ALTER TABLE public.stock_pack_groups ADD COLUMN IF NOT EXISTS galpao TEXT;
ALTER TABLE public.stock_pack_groups ADD COLUMN IF NOT EXISTS com_desempenadeira BOOLEAN DEFAULT FALSE;

ALTER TABLE public.estoque_pronto ADD COLUMN IF NOT EXISTS batch_id TEXT NOT NULL DEFAULT '';
ALTER TABLE public.estoque_pronto ADD COLUMN IF NOT EXISTS stock_item_id TEXT NOT NULL DEFAULT '';
ALTER TABLE public.estoque_pronto ADD COLUMN IF NOT EXISTS stock_item_code TEXT;
ALTER TABLE public.estoque_pronto ADD COLUMN IF NOT EXISTS stock_item_name TEXT;
ALTER TABLE public.estoque_pronto ADD COLUMN IF NOT EXISTS quantidade_total NUMERIC DEFAULT 0;
ALTER TABLE public.estoque_pronto ADD COLUMN IF NOT EXISTS quantidade_disponivel NUMERIC DEFAULT 0;
ALTER TABLE public.estoque_pronto ADD COLUMN IF NOT EXISTS localizacao TEXT;
ALTER TABLE public.estoque_pronto ADD COLUMN IF NOT EXISTS observacoes TEXT;
ALTER TABLE public.estoque_pronto ADD COLUMN IF NOT EXISTS produtos JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.estoque_pronto ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE public.estoque_pronto ADD COLUMN IF NOT EXISTS pallet TEXT;
ALTER TABLE public.estoque_pronto ADD COLUMN IF NOT EXISTS galpao TEXT;
ALTER TABLE public.estoque_pronto ADD COLUMN IF NOT EXISTS com_desempenadeira BOOLEAN DEFAULT FALSE;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. CORRIGIR VIEW vw_dados_analiticos (estava causando erro no sync_database)
--    O banco tentava renomear coluna 'data_bipagem' → 'bipado_', falhando.
--    Solução: DROP + recreate com o nome correto.
-- ─────────────────────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS public.vw_dados_analiticos;
CREATE OR REPLACE VIEW public.vw_dados_analiticos AS
SELECT
  o.id          AS id_pedido,
  o.order_id    AS codigo_pedido,
  o.data        AS data_pedido,
  o.canal,
  o.status      AS status_pedido,
  o.sku         AS sku_mestre,
  si.name       AS nome_produto,
  o.qty_final   AS quantidade_final,
  sl.user_name  AS bipado_por,
  sl.user_id    AS bipado_por_id,
  sl.scanned_at AS data_bipagem,
  o.venda_origem     AS canal_real,
  o.id_pedido_loja   AS num_loja_virtual,
  CASE
    WHEN o.status = 'BIPADO' AND sl.scanned_at IS NOT NULL
         AND TO_DATE(o.data, 'YYYY-MM-DD') < DATE(sl.scanned_at) THEN 'Bipado com Atraso'
    WHEN o.status = 'BIPADO'  THEN 'Bipado no Prazo'
    WHEN o.status = 'NORMAL'
         AND TO_DATE(o.data, 'YYYY-MM-DD') < CURRENT_DATE   THEN 'Atrasado'
    WHEN o.status = 'NORMAL'  THEN 'Pendente'
    ELSE o.status::text
  END AS status_derivado,
  EXTRACT(EPOCH FROM (sl.scanned_at - (o.data::date + interval '12 hours'))) / 3600
    AS tempo_separacao_horas
FROM public.orders o
LEFT JOIN public.stock_items si
  ON o.sku = si.code
LEFT JOIN public.scan_logs sl
  ON (sl.display_key = o.order_id OR sl.display_key = o.tracking)
 AND sl.status = 'OK';


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RECRIAR sync_database COM O DROP VIEW ANTES DO CREATE VIEW
--    Isso evita o erro de renomear coluna no futuro.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_database()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN

  -- 1. EXTENSÕES
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

  -- 2. ENUMS
  DO $do$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'canal_type') THEN
      CREATE TYPE public.canal_type AS ENUM ('ML', 'SHOPEE', 'SITE', 'ALL');
    ELSE
      BEGIN ALTER TYPE public.canal_type ADD VALUE 'SITE';
      EXCEPTION WHEN duplicate_object THEN NULL; END;
    END IF;
  END $do$;

  DO $do$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status_value') THEN
      CREATE TYPE public.order_status_value AS ENUM ('NORMAL', 'ERRO', 'DEVOLVIDO', 'BIPADO', 'SOLUCIONADO');
    END IF;
  END $do$;

  -- 3. TABELAS (IF NOT EXISTS garante idempotência)
  CREATE TABLE IF NOT EXISTS public.app_settings (
    id SERIAL PRIMARY KEY, key TEXT UNIQUE NOT NULL, value JSONB
  );
  CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    name TEXT, email TEXT UNIQUE, password TEXT, role TEXT DEFAULT 'operator',
    setor TEXT[], created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(),
    device_id TEXT, device_name TEXT, device_model TEXT, permission_level INT DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS public.stock_items (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'INSUMO',
    unit TEXT DEFAULT 'un', current_qty REAL DEFAULT 0, reserved_qty REAL DEFAULT 0,
    ready_qty REAL DEFAULT 0, min_qty REAL DEFAULT 0, mixed_qty REAL DEFAULT 0,
    category TEXT, color TEXT, product_type TEXT, barcode TEXT,
    substitute_product_code TEXT, expedition_items JSONB DEFAULT '[]'::jsonb,
    is_volatile_infinite BOOLEAN DEFAULT false, sell_price NUMERIC, cost_price NUMERIC,
    description TEXT, status TEXT DEFAULT 'active', localizacao TEXT, pallet TEXT, galpao TEXT,
    base_type TEXT, stock_initial_day REAL, stock_final_day REAL, day_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS public.stock_movements (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    stock_item_code TEXT, stock_item_name TEXT, origin TEXT, qty_delta REAL,
    ref TEXT, created_by_name TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS public.product_boms (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, kind TEXT DEFAULT 'PRODUTO',
    unit TEXT DEFAULT 'un', current_qty REAL DEFAULT 0, reserved_qty REAL DEFAULT 0,
    ready_qty REAL DEFAULT 0, min_qty REAL DEFAULT 0,
    category TEXT, color TEXT, product_type TEXT, barcode TEXT,
    substitute_product_code TEXT, expedition_items JSONB DEFAULT '[]'::jsonb,
    is_volatile_infinite BOOLEAN DEFAULT false, sell_price NUMERIC, cost_price NUMERIC,
    description TEXT, status TEXT DEFAULT 'active',
    bom_composition JSONB DEFAULT '{}'::jsonb, items JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS public.orders (
    id TEXT PRIMARY KEY, order_id TEXT, tracking TEXT, sku TEXT,
    qty_original REAL, multiplicador REAL DEFAULT 1, qty_final REAL,
    color TEXT, canal TEXT, data TEXT, data_prevista_envio TEXT,
    status TEXT DEFAULT 'NORMAL', customer_name TEXT, customer_cpf_cnpj TEXT,
    price_gross NUMERIC DEFAULT 0, price_total NUMERIC DEFAULT 0,
    platform_fees NUMERIC DEFAULT 0, shipping_fee NUMERIC DEFAULT 0,
    shipping_paid_by_customer NUMERIC DEFAULT 0, price_net NUMERIC DEFAULT 0,
    error_reason TEXT, resolution_details TEXT, bling_numero TEXT,
    venda_origem TEXT, id_pedido_loja TEXT, numero_pedido_loja TEXT,
    tracking_code TEXT, vinculado_bling BOOLEAN DEFAULT false,
    etiqueta_gerada BOOLEAN DEFAULT false, plataforma_origem TEXT,
    data_expiracao TEXT, lote_id TEXT, id_bling TEXT,
    situacao_id TEXT, situacao_valor TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS public.scan_logs (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    user_id UUID, user_name TEXT, device TEXT, display_key TEXT,
    status TEXT, synced BOOLEAN DEFAULT false, canal TEXT,
    scanned_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS public.sku_links (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    imported_sku TEXT UNIQUE NOT NULL, master_product_sku TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS public.weighing_batches (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    stock_item_code TEXT, stock_item_name TEXT,
    initial_qty REAL, used_qty REAL DEFAULT 0, weighing_type TEXT DEFAULT 'daily',
    created_by_id TEXT, created_by_name TEXT, created_at TIMESTAMPTZ DEFAULT NOW(),
    operador_maquina TEXT, operador_batedor TEXT, quantidade_batedor REAL,
    com_cor BOOLEAN DEFAULT false, tipo_operacao TEXT, equipe_mistura TEXT,
    destino TEXT, base_sku TEXT, product_code TEXT, qty_produced REAL,
    batch_name TEXT, produtos JSONB DEFAULT '[]'::jsonb
  );
  CREATE TABLE IF NOT EXISTS public.grinding_batches (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    source_insumo_code TEXT, source_insumo_name TEXT, source_qty_used REAL,
    output_insumo_code TEXT, output_insumo_name TEXT, output_qty_produced REAL,
    mode TEXT DEFAULT 'manual', user_id TEXT, user_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS public.production_plans (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    name TEXT, status TEXT DEFAULT 'active', parameters JSONB DEFAULT '{}'::jsonb,
    created_by TEXT, plan_date DATE, created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS public.production_plan_items (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    plan_id UUID, sku TEXT, name TEXT, qty REAL, unit TEXT, status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS public.shopping_list_items (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    name TEXT NOT NULL, quantity REAL DEFAULT 1, unit TEXT DEFAULT 'un',
    is_purchased BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS public.import_history (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    file_name TEXT, processed_at TIMESTAMPTZ DEFAULT NOW(),
    user_name TEXT, item_count INT DEFAULT 0, unlinked_count INT DEFAULT 0,
    processed_data JSONB DEFAULT '[]'::jsonb, canal TEXT
  );
  CREATE TABLE IF NOT EXISTS public.etiquetas_historico (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    lote_id TEXT, canal TEXT, total INT DEFAULT 0, geradas INT DEFAULT 0,
    erros INT DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW(), data JSONB DEFAULT '{}'::jsonb
  );
  CREATE TABLE IF NOT EXISTS public.returns (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    tracking TEXT, customer_name TEXT, logged_by_id UUID, logged_by_name TEXT,
    logged_at TIMESTAMPTZ DEFAULT NOW(), order_id TEXT
  );
  CREATE TABLE IF NOT EXISTS public.admin_notices (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    text TEXT NOT NULL, level TEXT DEFAULT 'info', type TEXT DEFAULT 'general',
    created_by TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS public.stock_pack_groups (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    name TEXT NOT NULL,
    barcode TEXT,
    item_codes TEXT[] NOT NULL DEFAULT '{}',
    final_product_code TEXT,
    min_pack_qty REAL NOT NULL DEFAULT 0,
    tipo TEXT DEFAULT 'tradicional',
    quantidade_volatil NUMERIC DEFAULT 0,
    localizacao TEXT,
    pallet TEXT,
    galpao TEXT,
    com_desempenadeira BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  -- Adiciona colunas que podem não existir em instâncias antigas
  ALTER TABLE public.stock_pack_groups ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'tradicional';
  ALTER TABLE public.stock_pack_groups ADD COLUMN IF NOT EXISTS quantidade_volatil NUMERIC DEFAULT 0;
  ALTER TABLE public.stock_pack_groups ADD COLUMN IF NOT EXISTS barcode TEXT;
  ALTER TABLE public.stock_pack_groups ADD COLUMN IF NOT EXISTS final_product_code TEXT;
  ALTER TABLE public.stock_pack_groups ADD COLUMN IF NOT EXISTS localizacao TEXT;
  ALTER TABLE public.stock_pack_groups ADD COLUMN IF NOT EXISTS pallet TEXT;
  ALTER TABLE public.stock_pack_groups ADD COLUMN IF NOT EXISTS galpao TEXT;
  ALTER TABLE public.stock_pack_groups ADD COLUMN IF NOT EXISTS com_desempenadeira BOOLEAN DEFAULT FALSE;

  CREATE TABLE IF NOT EXISTS public.estoque_pronto (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    batch_id TEXT NOT NULL DEFAULT '',
    stock_item_id TEXT NOT NULL DEFAULT '',
    stock_item_code TEXT,
    stock_item_name TEXT,
    quantidade_total NUMERIC DEFAULT 0,
    quantidade_disponivel NUMERIC DEFAULT 0,
    localizacao TEXT,
    status TEXT DEFAULT 'PRONTO',
    observacoes TEXT,
    produtos JSONB DEFAULT '[]'::jsonb,
    created_by TEXT,
    barcode TEXT,
    pallet TEXT,
    galpao TEXT,
    com_desempenadeira BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  -- Adiciona colunas que podem não existir em instâncias antigas
  ALTER TABLE public.estoque_pronto ADD COLUMN IF NOT EXISTS quantidade_total NUMERIC DEFAULT 0;
  ALTER TABLE public.estoque_pronto ADD COLUMN IF NOT EXISTS quantidade_disponivel NUMERIC DEFAULT 0;
  ALTER TABLE public.estoque_pronto ADD COLUMN IF NOT EXISTS localizacao TEXT;
  ALTER TABLE public.estoque_pronto ADD COLUMN IF NOT EXISTS observacoes TEXT;
  ALTER TABLE public.estoque_pronto ADD COLUMN IF NOT EXISTS produtos JSONB DEFAULT '[]'::jsonb;
  ALTER TABLE public.estoque_pronto ADD COLUMN IF NOT EXISTS created_by TEXT;
  ALTER TABLE public.estoque_pronto ADD COLUMN IF NOT EXISTS barcode TEXT;
  ALTER TABLE public.estoque_pronto ADD COLUMN IF NOT EXISTS pallet TEXT;
  ALTER TABLE public.estoque_pronto ADD COLUMN IF NOT EXISTS galpao TEXT;
  ALTER TABLE public.estoque_pronto ADD COLUMN IF NOT EXISTS com_desempenadeira BOOLEAN DEFAULT FALSE;
  ALTER TABLE public.estoque_pronto ADD COLUMN IF NOT EXISTS stock_item_code TEXT;
  ALTER TABLE public.estoque_pronto ADD COLUMN IF NOT EXISTS stock_item_name TEXT;
  CREATE TABLE IF NOT EXISTS public.order_items (
    id TEXT PRIMARY KEY, order_id TEXT NOT NULL, bling_id TEXT, sku TEXT NOT NULL,
    nome TEXT, quantidade NUMERIC DEFAULT 1, preco_unitario NUMERIC DEFAULT 0,
    preco_total NUMERIC DEFAULT 0, status TEXT DEFAULT 'nao_sincronizado',
    data_criacao TIMESTAMPTZ DEFAULT NOW(), ultima_sincronizacao TIMESTAMPTZ,
    erro_mensagem TEXT
  );
  CREATE TABLE IF NOT EXISTS public.setores (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
  );
  -- etiquetas_prioritarias (adicionada na v5.4)
  CREATE TABLE IF NOT EXISTS public.etiquetas_prioritarias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pedido_id TEXT NOT NULL, numero_bling TEXT NOT NULL, nfe_lote TEXT NOT NULL,
    data_geracao TIMESTAMPTZ DEFAULT now(),
    status_processamento TEXT NOT NULL DEFAULT 'pendente'
      CHECK (status_processamento IN ('pendente', 'processando', 'concluido', 'salvo_no_pc', 'erro')),
    armazenagem TEXT NOT NULL DEFAULT 'zpl'
      CHECK (armazenagem IN ('zpl', 'pc')),
    conteudo_zpl TEXT, conteudo_txt TEXT, caminho_arquivo TEXT,
    rastreabilidade JSONB NOT NULL DEFAULT '{}'::jsonb,
    metadados JSONB DEFAULT '{}'::jsonb,
    criado_por TEXT, atualizado_em TIMESTAMPTZ DEFAULT now(), atualizado_por TEXT,
    CONSTRAINT etiquetas_prioritarias_num_nfe_uq UNIQUE (numero_bling, nfe_lote)
  );

  -- 4. VIEWS (DROP primeiro para evitar conflito de nomes de colunas)
  DROP VIEW IF EXISTS public.vw_dados_analiticos;
  CREATE OR REPLACE VIEW public.vw_dados_analiticos AS
  SELECT
    o.id AS id_pedido, o.order_id AS codigo_pedido, o.data AS data_pedido,
    o.canal, o.status AS status_pedido, o.sku AS sku_mestre,
    si.name AS nome_produto, o.qty_final AS quantidade_final,
    sl.user_name AS bipado_por, sl.user_id AS bipado_por_id,
    sl.scanned_at AS data_bipagem,
    o.venda_origem AS canal_real, o.id_pedido_loja AS num_loja_virtual,
    CASE
      WHEN o.status = 'BIPADO' AND sl.scanned_at IS NOT NULL
           AND TO_DATE(o.data, 'YYYY-MM-DD') < DATE(sl.scanned_at) THEN 'Bipado com Atraso'
      WHEN o.status = 'BIPADO'  THEN 'Bipado no Prazo'
      WHEN o.status = 'NORMAL'
           AND TO_DATE(o.data, 'YYYY-MM-DD') < CURRENT_DATE   THEN 'Atrasado'
      WHEN o.status = 'NORMAL'  THEN 'Pendente'
      ELSE o.status::text
    END AS status_derivado,
    EXTRACT(EPOCH FROM (sl.scanned_at - (o.data::date + interval '12 hours'))) / 3600
      AS tempo_separacao_horas
  FROM public.orders o
  LEFT JOIN public.stock_items si ON o.sku = si.code
  LEFT JOIN public.scan_logs sl
    ON (sl.display_key = o.order_id OR sl.display_key = o.tracking)
   AND sl.status = 'OK';

  -- 5. RLS (aplica para todas as tabelas públicas)
  DO $do$
  DECLARE tbl text;
  BEGIN
    FOR tbl IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
      EXECUTE format('DROP POLICY IF EXISTS "allow_all" ON public.%I', tbl);
      EXECUTE format('CREATE POLICY "allow_all" ON public.%I FOR ALL USING (true) WITH CHECK (true)', tbl);
    END LOOP;
  END $do$;

  RETURN 'sync_database v5.4 - OK';
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. FUNÇÃO AUXILIAR deduct_bom_recursive (dependência do weighing)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.deduct_bom_recursive(
    p_sku       TEXT,
    p_qty       REAL,
    p_origin    TEXT,
    p_ref       TEXT,
    p_user_name TEXT
) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
    v_bom_data JSONB;
    v_bom_item JSONB;
    v_comp_sku TEXT;
    v_comp_qty REAL;
BEGIN
    SELECT COALESCE(bom_composition->'items', items)
    INTO v_bom_data
    FROM public.product_boms WHERE code = p_sku;

    IF v_bom_data IS NOT NULL AND jsonb_array_length(v_bom_data) > 0 THEN
        FOR v_bom_item IN SELECT * FROM jsonb_array_elements(v_bom_data)
        LOOP
            v_comp_sku := COALESCE(v_bom_item->>'stockItemCode', v_bom_item->>'code');
            v_comp_qty := (v_bom_item->>'qty_per_pack')::REAL * p_qty;
            IF v_comp_sku IS NOT NULL THEN
                PERFORM public.deduct_bom_recursive(v_comp_sku, v_comp_qty, p_origin, p_ref, p_user_name);
            END IF;
        END LOOP;
    ELSE
        PERFORM public.adjust_stock_quantity(p_sku, -p_qty, p_origin, p_ref, p_user_name);
    END IF;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. FUNÇÃO record_weighing_and_deduct_stock (estava ausente no banco)
--    Elimina overloads antigos para evitar HTTP 300 (ambiguidade de assinatura)
-- ─────────────────────────────────────────────────────────────────────────────
-- Remover versões ambíguas caso existam
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT oid::regprocedure::text AS sig
    FROM pg_proc
    WHERE proname = 'record_weighing_and_deduct_stock'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE';
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.record_weighing_and_deduct_stock(
    p_product_code       TEXT,
    p_qty_produced       REAL,
    p_user_id            TEXT,
    p_batch_name         TEXT,
    p_operador_maquina   TEXT,
    p_operador_batedor   TEXT,
    p_quantidade_batedor REAL,
    p_com_cor            BOOLEAN,
    p_tipo_operacao      TEXT,
    p_equipe_mistura     TEXT,
    p_destino            TEXT,
    p_base_sku           TEXT,
    p_produtos           JSONB DEFAULT '[]'::jsonb
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_item_name  TEXT;
    v_user_name  TEXT;
    v_prod_item  JSONB;
    v_insumo_code TEXT;
    v_qty_needed REAL;
BEGIN
    SELECT name INTO v_user_name FROM public.users WHERE id::text = p_user_id;

    IF p_produtos IS NULL OR jsonb_array_length(p_produtos) = 0 THEN
        SELECT name INTO v_item_name FROM public.stock_items WHERE code = p_product_code;
        INSERT INTO public.weighing_batches (
            stock_item_code, stock_item_name, initial_qty, weighing_type,
            created_by_id, created_by_name, product_code, qty_produced,
            operador_maquina, operador_batedor, quantidade_batedor,
            com_cor, tipo_operacao, equipe_mistura, destino, base_sku,
            batch_name, produtos
        ) VALUES (
            p_product_code, COALESCE(v_item_name, p_product_code), p_qty_produced, 'daily',
            p_user_id, v_user_name, p_product_code, p_qty_produced,
            p_operador_maquina, p_operador_batedor, p_quantidade_batedor,
            p_com_cor, p_tipo_operacao, p_equipe_mistura, p_destino, p_base_sku,
            p_batch_name,
            jsonb_build_array(jsonb_build_object(
                'sku', p_product_code,
                'nome', COALESCE(v_item_name, p_product_code),
                'qty_batida', p_quantidade_batedor,
                'qty_ensacada', p_qty_produced
            ))
        );
        p_produtos := jsonb_build_array(jsonb_build_object(
            'sku', p_product_code,
            'qty_batida', p_quantidade_batedor,
            'qty_ensacada', p_qty_produced
        ));
    ELSE
        INSERT INTO public.weighing_batches (
            stock_item_code, stock_item_name, initial_qty, weighing_type,
            created_by_id, created_by_name, product_code, qty_produced,
            operador_maquina, operador_batedor, quantidade_batedor,
            com_cor, tipo_operacao, equipe_mistura, destino, base_sku,
            batch_name, produtos
        ) VALUES (
            p_product_code, 'Lote Múltiplo', p_qty_produced, 'daily',
            p_user_id, v_user_name, p_product_code, p_qty_produced,
            p_operador_maquina, p_operador_batedor, p_quantidade_batedor,
            p_com_cor, p_tipo_operacao, p_equipe_mistura, p_destino, p_base_sku,
            p_batch_name, p_produtos
        );
    END IF;

    FOR v_prod_item IN SELECT * FROM jsonb_array_elements(p_produtos)
    LOOP
        v_insumo_code := v_prod_item->>'sku';
        v_qty_needed  := (v_prod_item->>'qty_batida')::REAL;

        IF p_tipo_operacao = 'SO_BATEU' THEN
            PERFORM public.deduct_bom_recursive(v_insumo_code, v_qty_needed, 'ENSACAMENTO', 'Mistura (Só Bateu)', v_user_name);
            UPDATE public.stock_items SET mixed_qty = COALESCE(mixed_qty, 0) + v_qty_needed WHERE code = v_insumo_code;

        ELSIF p_tipo_operacao = 'SO_ENSACADEIRA' THEN
            UPDATE public.stock_items SET mixed_qty = COALESCE(mixed_qty, 0) - (v_prod_item->>'qty_ensacada')::REAL WHERE code = v_insumo_code;
            PERFORM public.adjust_stock_quantity(v_insumo_code, (v_prod_item->>'qty_ensacada')::REAL, 'ENSACAMENTO', 'Produção Ensacadeira', v_user_name);

        ELSE
            PERFORM public.deduct_bom_recursive(v_insumo_code, v_qty_needed, 'ENSACAMENTO', 'Mistura (Bateu+Ensacou)', v_user_name);
            PERFORM public.adjust_stock_quantity(v_insumo_code, (v_prod_item->>'qty_ensacada')::REAL, 'ENSACAMENTO', 'Produção Completa', v_user_name);
            IF (v_prod_item->>'qty_batida')::REAL > (v_prod_item->>'qty_ensacada')::REAL THEN
                UPDATE public.stock_items
                SET mixed_qty = COALESCE(mixed_qty, 0) +
                    ((v_prod_item->>'qty_batida')::REAL - (v_prod_item->>'qty_ensacada')::REAL)
                WHERE code = v_insumo_code;
            END IF;
        END IF;
    END LOOP;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. RECRIAR adjust_stock_quantity E record_production_run SEM AMBIGUIDADE
--    (Tinham HTTP 300 por overloads duplicados)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT oid::regprocedure::text AS sig FROM pg_proc WHERE proname = 'adjust_stock_quantity'
  LOOP EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE'; END LOOP;

  FOR r IN
    SELECT oid::regprocedure::text AS sig FROM pg_proc WHERE proname = 'record_production_run'
  LOOP EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE'; END LOOP;

  FOR r IN
    SELECT oid::regprocedure::text AS sig FROM pg_proc WHERE proname = 'cancel_scan_id_and_revert_stock'
  LOOP EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE'; END LOOP;

  FOR r IN
    SELECT oid::regprocedure::text AS sig FROM pg_proc WHERE proname = 'record_grinding_run'
  LOOP EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.adjust_stock_quantity(
    item_code     text,
    quantity_delta real,
    origin_text   text,
    ref_text      text,
    user_name     text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    item_id   uuid;
    item_name text;
BEGIN
    SELECT id, name INTO item_id, item_name FROM public.stock_items WHERE code = item_code;
    IF item_id IS NULL THEN RAISE EXCEPTION 'Item not found: %', item_code; END IF;
    UPDATE public.stock_items SET current_qty = current_qty + quantity_delta WHERE id = item_id;
    INSERT INTO public.stock_movements (stock_item_code, stock_item_name, origin, qty_delta, ref, created_by_name)
    VALUES (item_code, item_name, origin_text, quantity_delta, ref_text, user_name);
END;
$$;

CREATE OR REPLACE FUNCTION public.record_production_run(
    item_code         text,
    quantity_to_produce real,
    ref_text          text,
    user_name         text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    bom_data    jsonb;
    bom_item    jsonb;
    insumo_code text;
    qty_needed  real;
BEGIN
    PERFORM public.adjust_stock_quantity(item_code, quantity_to_produce, 'PRODUCAO_MANUAL', ref_text, user_name);
    SELECT COALESCE(bom_composition->'items', items) INTO bom_data FROM public.product_boms WHERE code = item_code;
    IF bom_data IS NOT NULL THEN
        FOR bom_item IN SELECT * FROM jsonb_array_elements(bom_data)
        LOOP
            insumo_code := COALESCE(bom_item->>'stockItemCode', bom_item->>'code');
            qty_needed  := (bom_item->>'qty_per_pack')::real * quantity_to_produce;
            IF insumo_code IS NOT NULL THEN
                PERFORM public.adjust_stock_quantity(insumo_code, -qty_needed, 'PRODUCAO_MANUAL', ref_text || ' (Consumo)', user_name);
            END IF;
        END LOOP;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_scan_id_and_revert_stock(
    scan_id_to_cancel uuid,
    user_name         text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    scan_row  record;
    order_row record;
    master_sku text;
BEGIN
    SELECT * INTO scan_row FROM public.scan_logs WHERE id = scan_id_to_cancel;
    IF scan_row IS NULL THEN RETURN; END IF;
    SELECT * INTO order_row FROM public.orders
    WHERE (order_id = scan_row.display_key OR tracking = scan_row.display_key) AND status = 'BIPADO';
    IF order_row IS NOT NULL THEN
        UPDATE public.orders SET status = 'NORMAL' WHERE id = order_row.id;
        SELECT master_product_sku INTO master_sku FROM public.sku_links WHERE imported_sku = order_row.sku;
        IF master_sku IS NULL THEN master_sku := order_row.sku; END IF;
        PERFORM public.adjust_stock_quantity(master_sku, 1, 'AJUSTE_MANUAL', 'Cancelamento Bipagem ' || scan_row.display_key, user_name);
    END IF;
    DELETE FROM public.scan_logs WHERE id = scan_id_to_cancel;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_grinding_run(
    source_code  text,
    source_qty   real,
    output_code  text,
    output_name  text,
    output_qty   real,
    op_mode      text,
    op_user_id   text,
    op_user_name text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE source_name text;
BEGIN
    SELECT name INTO source_name FROM public.stock_items WHERE code = source_code;
    PERFORM public.adjust_stock_quantity(source_code, -source_qty, 'MOAGEM', 'Consumo Moagem', op_user_name);
    IF NOT EXISTS (SELECT 1 FROM public.stock_items WHERE code = output_code) THEN
        INSERT INTO public.stock_items (code, name, kind, unit, current_qty)
        VALUES (output_code, output_name, 'INSUMO', 'kg', 0);
    END IF;
    PERFORM public.adjust_stock_quantity(output_code, output_qty, 'MOAGEM', 'Produção Moagem', op_user_name);
    INSERT INTO public.grinding_batches (source_insumo_code, source_insumo_name, source_qty_used,
        output_insumo_code, output_insumo_name, output_qty_produced, mode, user_id, user_name)
    VALUES (source_code, source_name, source_qty, output_code, output_name, output_qty, op_mode, op_user_id, op_user_name);
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. CORRIGIR clear_scan_history (DELETE sem WHERE causava erro)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.clear_scan_history()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    DELETE FROM public.scan_logs WHERE id IS NOT NULL;
    UPDATE public.orders SET status = 'NORMAL' WHERE status = 'BIPADO';
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 8. CORRIGIR reset_database (DELETE sem WHERE causava erro)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reset_database()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    DELETE FROM public.scan_logs         WHERE id IS NOT NULL;
    DELETE FROM public.orders            WHERE id IS NOT NULL;
    DELETE FROM public.stock_movements   WHERE id IS NOT NULL;
    DELETE FROM public.weighing_batches  WHERE id IS NOT NULL;
    DELETE FROM public.grinding_batches  WHERE id IS NOT NULL;
    DELETE FROM public.production_plans  WHERE id IS NOT NULL;
    DELETE FROM public.production_plan_items WHERE id IS NOT NULL;
    DELETE FROM public.shopping_list_items   WHERE id IS NOT NULL;
    DELETE FROM public.returns           WHERE id IS NOT NULL;
    DELETE FROM public.import_history    WHERE id IS NOT NULL;
    DELETE FROM public.admin_notices     WHERE id IS NOT NULL;
    UPDATE public.stock_items SET current_qty = 0;
    RETURN 'Banco de dados limpo com sucesso.';
END;
$$;

-- =============================================================================
-- FIM DA MIGRAÇÃO
-- Após rodar este script, confirme chamando: SELECT sync_database();
-- =============================================================================
