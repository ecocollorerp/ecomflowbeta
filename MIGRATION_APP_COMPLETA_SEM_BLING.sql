-- ============================================================================
-- MIGRATION_APP_COMPLETA_SEM_BLING.sql
-- Objetivo: sincronizar banco com a aplicação (exceto fluxos Bling)
-- Execução: pode rodar inteiro no Supabase SQL Editor
-- ============================================================================

-- 1) Tipos auxiliares
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stock_kind') THEN
    CREATE TYPE stock_kind AS ENUM ('INSUMO', 'PRODUTO', 'PROCESSADO');
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Tabelas base usadas no app
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000)
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  password TEXT,
  role TEXT,
  setor TEXT[],
  prefix TEXT,
  attendance JSONB DEFAULT '[]'::jsonb,
  ui_settings JSONB,
  created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000)
);

CREATE TABLE IF NOT EXISTS stock_items (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  kind stock_kind DEFAULT 'INSUMO',
  current_qty NUMERIC(12,2) DEFAULT 0,
  reserved_qty NUMERIC(12,2) DEFAULT 0,
  min_qty NUMERIC(12,2) DEFAULT 0,
  cost_price NUMERIC(12,4),
  sell_price NUMERIC(12,4),
  bling_id TEXT,
  bling_sku TEXT,
  unit TEXT DEFAULT 'UN',
  category TEXT,
  status TEXT DEFAULT 'ATIVO',
  barcode TEXT,
  substitute_product_code TEXT,
  product_type TEXT,
  expedition_items JSONB DEFAULT '[]'::jsonb,
  created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
  updated_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000)
);

CREATE TABLE IF NOT EXISTS product_boms (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  kind stock_kind DEFAULT 'PRODUTO',
  bom_composition JSONB,
  current_qty NUMERIC(12,2) DEFAULT 0,
  reserved_qty NUMERIC(12,2) DEFAULT 0,
  ready_qty NUMERIC(12,2) DEFAULT 0,
  min_qty NUMERIC(12,2) DEFAULT 0,
  is_ready BOOLEAN DEFAULT FALSE,
  ready_location TEXT,
  ready_date BIGINT,
  ready_batch_id TEXT,
  cost_price NUMERIC(12,4),
  sell_price NUMERIC(12,4),
  bling_id TEXT,
  bling_sku TEXT,
  unit TEXT DEFAULT 'UN',
  category TEXT,
  status TEXT DEFAULT 'ATIVO',
  created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
  updated_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000)
);

CREATE TABLE IF NOT EXISTS sku_links (
  imported_sku TEXT PRIMARY KEY,
  master_product_sku TEXT NOT NULL,
  created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
  updated_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000)
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id TEXT PRIMARY KEY,
  stock_item_code TEXT,
  stock_item_name TEXT,
  origin TEXT,
  qty_delta NUMERIC(12,2),
  ref TEXT,
  product_sku TEXT,
  created_by_name TEXT,
  from_weighing BOOLEAN DEFAULT FALSE,
  created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000)
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  order_id TEXT,
  tracking TEXT,
  sku TEXT,
  qty_original NUMERIC(12,2) DEFAULT 0,
  multiplicador NUMERIC(12,2) DEFAULT 1,
  qty_final NUMERIC(12,2) DEFAULT 0,
  color TEXT,
  canal TEXT,
  data TEXT,
  data_prevista_envio TEXT,
  status TEXT DEFAULT 'NORMAL',
  customer_name TEXT,
  customer_cpf_cnpj TEXT,
  price_gross NUMERIC(12,2) DEFAULT 0,
  platform_fees NUMERIC(12,2) DEFAULT 0,
  shipping_fee NUMERIC(12,2) DEFAULT 0,
  price_net NUMERIC(12,2) DEFAULT 0,
  error_reason TEXT,
  resolution_details JSONB,
  created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_order_sku_unique ON orders(order_id, sku);

CREATE TABLE IF NOT EXISTS returns (
  id TEXT PRIMARY KEY,
  tracking TEXT,
  customer_name TEXT,
  logged_by_id TEXT,
  logged_by_name TEXT,
  logged_at BIGINT,
  order_id TEXT,
  created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000)
);

CREATE TABLE IF NOT EXISTS scan_logs (
  id TEXT PRIMARY KEY,
  scanned_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
  user_id TEXT,
  user_name TEXT,
  device TEXT,
  display_key TEXT,
  status TEXT,
  synced BOOLEAN DEFAULT FALSE,
  canal TEXT
);

CREATE TABLE IF NOT EXISTS weighing_batches (
  id TEXT PRIMARY KEY,
  stock_item_code TEXT,
  stock_item_name TEXT,
  initial_qty NUMERIC(12,2) DEFAULT 0,
  used_qty NUMERIC(12,2) DEFAULT 0,
  weighing_type TEXT,
  created_by_id TEXT,
  created_by_name TEXT,
  created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000)
);

CREATE TABLE IF NOT EXISTS grinding_batches (
  id TEXT PRIMARY KEY,
  source_insumo_code TEXT,
  source_insumo_name TEXT,
  source_qty_used NUMERIC(12,2) DEFAULT 0,
  output_insumo_code TEXT,
  output_insumo_name TEXT,
  output_qty_produced NUMERIC(12,2) DEFAULT 0,
  mode TEXT,
  user_id TEXT,
  user_name TEXT,
  created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000)
);

CREATE TABLE IF NOT EXISTS production_plans (
  id TEXT PRIMARY KEY,
  name TEXT,
  status TEXT,
  parameters JSONB,
  plan_date TEXT,
  created_by TEXT,
  created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000)
);

CREATE TABLE IF NOT EXISTS production_plan_items (
  id TEXT PRIMARY KEY,
  plan_id TEXT,
  stock_item_code TEXT,
  stock_item_name TEXT,
  quantity NUMERIC(12,2) DEFAULT 0,
  unit TEXT,
  created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000)
);

CREATE TABLE IF NOT EXISTS shopping_list_items (
  id TEXT PRIMARY KEY,
  stock_item_code TEXT UNIQUE,
  name TEXT,
  quantity NUMERIC(12,2) DEFAULT 0,
  unit TEXT,
  is_purchased BOOLEAN DEFAULT FALSE,
  created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000)
);

CREATE TABLE IF NOT EXISTS admin_notices (
  id TEXT PRIMARY KEY,
  text TEXT,
  level TEXT,
  type TEXT,
  created_by TEXT,
  created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000)
);

CREATE TABLE IF NOT EXISTS import_history (
  id TEXT PRIMARY KEY,
  file_name TEXT,
  processed_at BIGINT,
  user_name TEXT,
  item_count INT DEFAULT 0,
  unlinked_count INT DEFAULT 0,
  processed_data JSONB,
  canal TEXT
);

CREATE TABLE IF NOT EXISTS etiquetas_historico (
  id TEXT PRIMARY KEY,
  created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
  created_by_id TEXT,
  created_by_name TEXT,
  page_count INT DEFAULT 0,
  zpl_content TEXT,
  page_hashes JSONB
);

CREATE TABLE IF NOT EXISTS stock_pack_groups (
  id TEXT PRIMARY KEY,
  name TEXT,
  description TEXT,
  packs JSONB DEFAULT '[]'::jsonb,
  created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
  updated_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000)
);

-- 3) Compatibilidade de colunas em bases já existentes
ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS min_qty NUMERIC(12,2) DEFAULT 0;
ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS substitute_product_code TEXT;
ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS product_type TEXT;
ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS expedition_items JSONB DEFAULT '[]'::jsonb;

ALTER TABLE product_boms ADD COLUMN IF NOT EXISTS min_qty NUMERIC(12,2) DEFAULT 0;
ALTER TABLE product_boms ADD COLUMN IF NOT EXISTS ready_qty NUMERIC(12,2) DEFAULT 0;
ALTER TABLE product_boms ADD COLUMN IF NOT EXISTS bom_composition JSONB;
ALTER TABLE product_boms ADD COLUMN IF NOT EXISTS cost_price NUMERIC(12,4);
ALTER TABLE product_boms ADD COLUMN IF NOT EXISTS sell_price NUMERIC(12,4);

ALTER TABLE sku_links ADD COLUMN IF NOT EXISTS created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000);
ALTER TABLE sku_links ADD COLUMN IF NOT EXISTS updated_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000);

-- Compatibilidade: tabela orders (bases antigas podem não ter essas colunas)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS sku TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS qty_original NUMERIC(12,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS multiplicador NUMERIC(12,2) DEFAULT 1;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS qty_final NUMERIC(12,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS color TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS canal TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS data TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS data_prevista_envio TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'NORMAL';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_cpf_cnpj TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS price_gross NUMERIC(12,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS platform_fees NUMERIC(12,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_fee NUMERIC(12,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS price_net NUMERIC(12,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS error_reason TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS resolution_details JSONB;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000);

-- 4) View usada na BI (fallback simples)
CREATE OR REPLACE VIEW vw_dados_analiticos AS
SELECT
  o.id,
  o.order_id,
  o.sku,
  o.status,
  o.canal,
  o.qty_final,
  o.price_net,
  o.created_at
FROM orders o;

-- 5) RPCs necessárias ao app (exceto Bling)

-- Limpeza prévia de funções (evita erro 42P13 de retorno/assinatura)
DROP FUNCTION IF EXISTS adjust_stock_quantity(text, numeric, text, text, text);
DROP FUNCTION IF EXISTS adjust_stock_quantity(text, real, text, text, text);

DROP FUNCTION IF EXISTS record_production_run(text, numeric, text, text);
DROP FUNCTION IF EXISTS record_production_run(text, real, text, text);

DROP FUNCTION IF EXISTS record_weighing_and_deduct_stock(text, numeric, text, text, text);
DROP FUNCTION IF EXISTS record_weighing_and_deduct_stock(text, real, text, text, text);

DROP FUNCTION IF EXISTS record_grinding_run(text, numeric, text, text, numeric, text, text, text);
DROP FUNCTION IF EXISTS record_grinding_run(text, real, text, text, real, text, text, text);

DROP FUNCTION IF EXISTS cancel_scan_id_and_revert_stock(text, text);
DROP FUNCTION IF EXISTS delete_orders(text[]);
DROP FUNCTION IF EXISTS clear_scan_history();
DROP FUNCTION IF EXISTS bulk_set_initial_stock(jsonb, text);
DROP FUNCTION IF EXISTS login(text, text);
DROP FUNCTION IF EXISTS check_setup_status();
DROP FUNCTION IF EXISTS sync_database();
DROP FUNCTION IF EXISTS reset_database();

CREATE OR REPLACE FUNCTION adjust_stock_quantity(
  item_code text,
  quantity_delta numeric,
  origin_text text,
  ref_text text,
  user_name text
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  target_name text;
BEGIN
  UPDATE product_boms
  SET current_qty = COALESCE(current_qty,0) + quantity_delta,
      updated_at = (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000)
  WHERE code = item_code;

  IF NOT FOUND THEN
    UPDATE stock_items
    SET current_qty = COALESCE(current_qty,0) + quantity_delta,
        updated_at = (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000)
    WHERE code = item_code;
  END IF;

  SELECT name INTO target_name FROM product_boms WHERE code = item_code;
  IF target_name IS NULL THEN
    SELECT name INTO target_name FROM stock_items WHERE code = item_code;
  END IF;

  INSERT INTO stock_movements(
    id, stock_item_code, stock_item_name, origin, qty_delta, ref, created_by_name, created_at
  ) VALUES (
    'mov_' || substr(md5(random()::text),1,12),
    item_code,
    COALESCE(target_name, item_code),
    origin_text,
    quantity_delta,
    ref_text,
    user_name,
    (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000)
  );
END;
$$;

CREATE OR REPLACE FUNCTION record_production_run(
  item_code text,
  quantity_to_produce numeric,
  ref_text text,
  user_name text
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  comp jsonb;
  component jsonb;
BEGIN
  SELECT bom_composition INTO comp FROM product_boms WHERE code = item_code;

  IF comp IS NOT NULL AND comp ? 'items' THEN
    FOR component IN SELECT * FROM jsonb_array_elements(comp->'items') LOOP
      PERFORM adjust_stock_quantity(
        component->>'insumo_code',
        -1 * COALESCE((component->>'quantity')::numeric, 0) * quantity_to_produce,
        'PRODUCAO_INTERNA',
        ref_text,
        user_name
      );
    END LOOP;
  END IF;

  PERFORM adjust_stock_quantity(item_code, quantity_to_produce, 'PRODUCAO_INTERNA', ref_text, user_name);
END;
$$;

CREATE OR REPLACE FUNCTION record_weighing_and_deduct_stock(
  item_code text,
  quantity_to_weigh numeric,
  weighing_type_text text,
  user_id text,
  user_name text
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  item_name text;
BEGIN
  SELECT name INTO item_name FROM stock_items WHERE code = item_code;

  INSERT INTO weighing_batches(
    id, stock_item_code, stock_item_name, initial_qty, used_qty, weighing_type, created_by_id, created_by_name, created_at
  ) VALUES (
    'wb_' || substr(md5(random()::text),1,12),
    item_code,
    COALESCE(item_name, item_code),
    quantity_to_weigh,
    0,
    weighing_type_text,
    user_id,
    user_name,
    (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000)
  );

  PERFORM adjust_stock_quantity(item_code, -1 * quantity_to_weigh, 'PESAGEM', 'Lote Pesado', user_name);
END;
$$;

CREATE OR REPLACE FUNCTION record_grinding_run(
  source_code text,
  source_qty numeric,
  output_code text,
  output_name text,
  output_qty numeric,
  op_mode text,
  op_user_id text,
  op_user_name text
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  source_name text;
BEGIN
  SELECT name INTO source_name FROM stock_items WHERE code = source_code;

  PERFORM adjust_stock_quantity(source_code, -1 * source_qty, 'MOAGEM', 'Consumo Moagem', op_user_name);

  IF NOT EXISTS (SELECT 1 FROM stock_items WHERE code = output_code) THEN
    INSERT INTO stock_items(id, code, name, kind, unit, current_qty, created_at, updated_at)
    VALUES ('mat_' || substr(md5(random()::text),1,12), output_code, output_name, 'INSUMO', 'kg', 0,
            (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000), (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000));
  END IF;

  PERFORM adjust_stock_quantity(output_code, output_qty, 'MOAGEM', 'Produção Moagem', op_user_name);

  INSERT INTO grinding_batches(
    id, source_insumo_code, source_insumo_name, source_qty_used, output_insumo_code, output_insumo_name,
    output_qty_produced, mode, user_id, user_name, created_at
  ) VALUES (
    'gb_' || substr(md5(random()::text),1,12), source_code, COALESCE(source_name, source_code), source_qty,
    output_code, output_name, output_qty, op_mode, op_user_id, op_user_name,
    (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000)
  );
END;
$$;

CREATE OR REPLACE FUNCTION cancel_scan_id_and_revert_stock(scan_id_to_cancel text, user_name text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE scan_logs SET status = 'CANCELADO', synced = false WHERE id = scan_id_to_cancel;
END;
$$;

CREATE OR REPLACE FUNCTION delete_orders(order_ids text[])
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM orders WHERE id = ANY(order_ids);
END;
$$;

CREATE OR REPLACE FUNCTION clear_scan_history()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM scan_logs;
END;
$$;

CREATE OR REPLACE FUNCTION bulk_set_initial_stock(updates jsonb, user_name text)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  rec jsonb;
  code_val text;
  qty_val numeric;
  changed int := 0;
BEGIN
  FOR rec IN SELECT * FROM jsonb_array_elements(updates) LOOP
    code_val := rec->>'item_code';
    qty_val := COALESCE((rec->>'new_initial_quantity')::numeric, 0);

    UPDATE product_boms
      SET current_qty = qty_val, updated_at = (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000)
    WHERE code = code_val;

    IF NOT FOUND THEN
      UPDATE stock_items
        SET current_qty = qty_val, updated_at = (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000)
      WHERE code = code_val;
    END IF;

    changed := changed + 1;
  END LOOP;

  RETURN jsonb_build_object('updated', changed);
END;
$$;

CREATE OR REPLACE FUNCTION login(login_input text, password_input text)
RETURNS TABLE (
  id text,
  name text,
  email text,
  role text,
  setor text[],
  password text,
  prefix text,
  attendance jsonb,
  ui_settings jsonb
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.name, u.email, u.role, u.setor, u.password, u.prefix, COALESCE(u.attendance, '[]'::jsonb), u.ui_settings
  FROM users u
  WHERE (
        lower(trim(coalesce(u.email, ''))) = lower(trim(coalesce(login_input, '')))
        OR lower(trim(coalesce(u.name, ''))) = lower(trim(coalesce(login_input, '')))
  )
    AND (trim(coalesce(u.password, '')) = trim(coalesce(password_input, '')) OR u.password IS NULL)
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION check_setup_status()
RETURNS jsonb LANGUAGE plpgsql AS $$
BEGIN
  RETURN jsonb_build_object(
    'tables_status', jsonb_build_array(
      jsonb_build_object('name','stock_items','exists', to_regclass('public.stock_items') IS NOT NULL),
      jsonb_build_object('name','product_boms','exists', to_regclass('public.product_boms') IS NOT NULL),
      jsonb_build_object('name','orders','exists', to_regclass('public.orders') IS NOT NULL),
      jsonb_build_object('name','users','exists', to_regclass('public.users') IS NOT NULL)
    ),
    'types_status', jsonb_build_array(
      jsonb_build_object('name','stock_kind','exists', EXISTS(SELECT 1 FROM pg_type WHERE typname='stock_kind'))
    ),
    'functions_status', jsonb_build_array(
      jsonb_build_object('name','adjust_stock_quantity','exists', EXISTS(SELECT 1 FROM pg_proc WHERE proname='adjust_stock_quantity')),
      jsonb_build_object('name','record_production_run','exists', EXISTS(SELECT 1 FROM pg_proc WHERE proname='record_production_run')),
      jsonb_build_object('name','login','exists', EXISTS(SELECT 1 FROM pg_proc WHERE proname='login'))
    ),
    'columns_status', jsonb_build_array(
      jsonb_build_object('table','stock_items','column','barcode','exists', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='stock_items' AND column_name='barcode')),
      jsonb_build_object('table','stock_items','column','substitute_product_code','exists', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='stock_items' AND column_name='substitute_product_code'))
    ),
    'db_version', '2.11.0'
  );
END;
$$;

CREATE OR REPLACE FUNCTION sync_database()
RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  RETURN 'ok';
END;
$$;

CREATE OR REPLACE FUNCTION reset_database()
RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  RETURN 'not_implemented';
END;
$$;

-- 6) Políticas permissivas para ambiente de implantação rápida
ALTER TABLE stock_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_boms ENABLE ROW LEVEL SECURITY;
ALTER TABLE sku_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY allow_all_stock_items ON stock_items FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY allow_all_product_boms ON product_boms FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY allow_all_sku_links ON sku_links FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY allow_all_stock_movements ON stock_movements FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY allow_all_orders ON orders FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY allow_all_users ON users FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- FIM
-- ============================================================================
