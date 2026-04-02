-- ============================================================================
-- ERP FÁBRICA PRO — BANCO DE DADOS COMPLETO v8.0
-- Data: 2025-03-31
--
-- Script IDEMPOTENTE: pode ser executado múltiplas vezes com segurança.
-- Corrige TODOS os mismatches entre TypeScript e banco.
--
-- Changelog v7 → v8:
--   • orders.canal:  canal_type ENUM → TEXT (suporta TIKTOK, custom stores)
--   • canal_type ENUM: +TIKTOK, +AUTO (retrocompat.)
--   • Índice idx_orders_canal recriado sobre TEXT
--
-- Changelog v6 → v7:
--   • orders:  +descontar_volatil, +tracking_code, +plataforma_origem,
--              +data_expiracao, +loja
--   • users:   +permissions (JSONB)
--   • stock_items: +bom_composition, +stock_initial_day, +stock_final_day,
--                  +day_date
--   • stock_movements: +new_total, +operator_name, +item_snapshot
--   • grinding_batches: +batch_name
--   • stock_pack_groups: +pack_size
--   • cost_calculations: +platform_fee (alias), colunas calculadas
--   • order_items: REFORMULADO — +bling_item_id, +item_id, +canal,
--                  +descricao, +unidade, +valor_unitario, +subtotal,
--                  +sincronizado_em, unique constraints p/ upsert
--   • audit_logs: +usuario_id, +descricao, +criado_em (2° esquema)
--   • nfes: limpeza de colunas duplicadas snake_case/camelCase
--   • NOVAS TABELAS: sync_log, purchase_planning, zpl_batches
--   • Todas RPCs atualizadas / idempotentes
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. EXTENSÕES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ─────────────────────────────────────────────────────────────────────────────
-- 0.1 ENUMS
-- ─────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'canal_type') THEN
        CREATE TYPE canal_type AS ENUM ('ML', 'SHOPEE', 'SITE', 'ALL', 'TIKTOK', 'AUTO');
    ELSE
        BEGIN ALTER TYPE canal_type ADD VALUE IF NOT EXISTS 'SITE';   EXCEPTION WHEN duplicate_object THEN NULL; END;
        BEGIN ALTER TYPE canal_type ADD VALUE IF NOT EXISTS 'ALL';    EXCEPTION WHEN duplicate_object THEN NULL; END;
        BEGIN ALTER TYPE canal_type ADD VALUE IF NOT EXISTS 'TIKTOK'; EXCEPTION WHEN duplicate_object THEN NULL; END;
        BEGIN ALTER TYPE canal_type ADD VALUE IF NOT EXISTS 'AUTO';   EXCEPTION WHEN duplicate_object THEN NULL; END;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status_value') THEN
        CREATE TYPE order_status_value AS ENUM ('NORMAL', 'ERRO', 'DEVOLVIDO', 'BIPADO', 'SOLUCIONADO');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'nfe_status') THEN
        CREATE TYPE nfe_status AS ENUM ('RASCUNHO', 'ASSINADA', 'ENVIADA', 'AUTORIZADA', 'CANCELADA', 'REJEITADA', 'ERRO');
    END IF;
END $$;

-- ═════════════════════════════════════════════════════════════════════════════
--  TABELAS
-- ═════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. app_settings
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_settings (
    key        TEXT         PRIMARY KEY,
    value      JSONB        NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ  DEFAULT NOW()
);

INSERT INTO app_settings (key, value) VALUES
    ('general', '{}'), ('bling', '{}'), ('zpl', '{}'), ('ui', '{}'), ('etiquetas', '{}')
ON CONFLICT (key) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. users
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id               UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    name             TEXT         NOT NULL,
    email            TEXT,
    password         TEXT,
    role             TEXT         NOT NULL DEFAULT 'OPERATOR',
    setor            TEXT[]       DEFAULT '{}',
    prefix           TEXT,
    attendance       JSONB        DEFAULT '[]'::jsonb,
    ui_settings      JSONB,
    permissions      JSONB,          -- v7: UserPermissions JSONB completo
    device_id        TEXT,
    device_name      TEXT,
    device_model     TEXT,
    permission_level INT          DEFAULT 1,
    avatar_base64    TEXT,
    created_at       TIMESTAMPTZ  DEFAULT NOW(),
    updated_at       TIMESTAMPTZ  DEFAULT NOW()
);

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS email            TEXT,
    ADD COLUMN IF NOT EXISTS prefix           TEXT,
    ADD COLUMN IF NOT EXISTS attendance       JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS ui_settings      JSONB,
    ADD COLUMN IF NOT EXISTS permissions      JSONB,
    ADD COLUMN IF NOT EXISTS device_id        TEXT,
    ADD COLUMN IF NOT EXISTS device_name      TEXT,
    ADD COLUMN IF NOT EXISTS device_model     TEXT,
    ADD COLUMN IF NOT EXISTS permission_level INT DEFAULT 1,
    ADD COLUMN IF NOT EXISTS avatar_base64    TEXT,
    ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_users_name  ON users (name);
CREATE INDEX IF NOT EXISTS idx_users_role  ON users (role);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users (email) WHERE email IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. stock_items
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_items (
    id                        UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    code                      TEXT         UNIQUE NOT NULL,
    name                      TEXT         NOT NULL,
    kind                      TEXT         NOT NULL DEFAULT 'INSUMO',
    unit                      TEXT         NOT NULL DEFAULT 'un',
    current_qty               REAL         NOT NULL DEFAULT 0,
    reserved_qty              REAL         DEFAULT 0,
    ready_qty                 REAL         DEFAULT 0,
    mixed_qty                 REAL         DEFAULT 0,
    min_qty                   REAL         NOT NULL DEFAULT 0,
    category                  TEXT         DEFAULT '',
    color                     TEXT,
    product_type              TEXT,
    base_type                 TEXT,
    expedition_items          JSONB        DEFAULT '[]'::jsonb,
    substitute_product_code   TEXT,
    barcode                   TEXT,
    localizacao               TEXT,
    pallet                    TEXT,
    galpao                    TEXT,
    is_volatile_infinite      BOOLEAN      DEFAULT FALSE,
    sell_price                REAL         DEFAULT 0,
    cost_price                REAL         DEFAULT 0,
    description               TEXT,
    status                    TEXT         DEFAULT 'ATIVO',
    bom_composition           JSONB        DEFAULT '{"items":[]}'::jsonb,  -- v7: composição BOM
    stock_initial_day         REAL,        -- v7: estoque início dia
    stock_final_day           REAL,        -- v7: estoque final dia
    day_date                  TEXT,        -- v7: data do dia (YYYY-MM-DD)
    created_at                TIMESTAMPTZ  DEFAULT NOW(),
    updated_at                TIMESTAMPTZ  DEFAULT NOW()
);

ALTER TABLE stock_items
    ADD COLUMN IF NOT EXISTS reserved_qty            REAL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS ready_qty               REAL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS mixed_qty               REAL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS base_type               TEXT,
    ADD COLUMN IF NOT EXISTS localizacao             TEXT,
    ADD COLUMN IF NOT EXISTS pallet                  TEXT,
    ADD COLUMN IF NOT EXISTS galpao                  TEXT,
    ADD COLUMN IF NOT EXISTS is_volatile_infinite    BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS sell_price              REAL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS cost_price              REAL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS description             TEXT,
    ADD COLUMN IF NOT EXISTS status                  TEXT DEFAULT 'ATIVO',
    ADD COLUMN IF NOT EXISTS barcode                 TEXT,
    ADD COLUMN IF NOT EXISTS substitute_product_code TEXT,
    ADD COLUMN IF NOT EXISTS bom_composition         JSONB DEFAULT '{"items":[]}'::jsonb,
    ADD COLUMN IF NOT EXISTS stock_initial_day       REAL,
    ADD COLUMN IF NOT EXISTS stock_final_day         REAL,
    ADD COLUMN IF NOT EXISTS day_date                TEXT,
    ADD COLUMN IF NOT EXISTS updated_at              TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_stock_items_code ON stock_items (code);
CREATE INDEX IF NOT EXISTS idx_stock_items_kind ON stock_items (kind);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. stock_movements
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_movements (
    id                UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    stock_item_code   TEXT         NOT NULL,
    stock_item_name   TEXT         NOT NULL DEFAULT '',
    origin            TEXT         NOT NULL DEFAULT 'AJUSTE_MANUAL',
    qty_delta         REAL         NOT NULL,
    ref               TEXT,
    product_sku       TEXT,
    created_by_name   TEXT,
    from_weighing     BOOLEAN      DEFAULT FALSE,
    new_total         REAL,          -- v7: total após movimentação
    operator_name     TEXT,          -- v7: nome do operador
    item_snapshot     JSONB,         -- v7: snapshot do item (StockItem serializado)
    created_at        TIMESTAMPTZ  DEFAULT NOW()
);

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stock_movements' AND column_name='created_by')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stock_movements' AND column_name='created_by_name')
    THEN
        ALTER TABLE stock_movements RENAME COLUMN created_by TO created_by_name;
    END IF;
END $$;

ALTER TABLE stock_movements
    ADD COLUMN IF NOT EXISTS from_weighing   BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS product_sku     TEXT,
    ADD COLUMN IF NOT EXISTS created_by_name TEXT,
    ADD COLUMN IF NOT EXISTS new_total       REAL,
    ADD COLUMN IF NOT EXISTS operator_name   TEXT,
    ADD COLUMN IF NOT EXISTS item_snapshot   JSONB;

CREATE INDEX IF NOT EXISTS idx_stock_mvt_item_code  ON stock_movements (stock_item_code);
CREATE INDEX IF NOT EXISTS idx_stock_mvt_created_at ON stock_movements (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_mvt_origin     ON stock_movements (origin);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. product_boms (Receitas / BOM + Dados do Produto)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_boms (
    code                    TEXT         PRIMARY KEY,
    name                    TEXT,
    description             TEXT,
    kind                    TEXT         DEFAULT 'PRODUTO',
    unit                    TEXT         DEFAULT 'un',
    category                TEXT         DEFAULT '',
    current_qty             REAL         DEFAULT 0,
    reserved_qty            REAL         DEFAULT 0,
    ready_qty               REAL         DEFAULT 0,
    min_qty                 REAL         DEFAULT 0,
    sell_price              REAL         DEFAULT 0,
    cost_price              REAL         DEFAULT 0,
    bling_id                TEXT,
    bling_sku               TEXT,
    is_ready                BOOLEAN      DEFAULT FALSE,
    ready_location          TEXT,
    ready_date              TIMESTAMPTZ,
    ready_batch_id          TEXT,
    bom_composition         JSONB        DEFAULT '{"items":[]}'::jsonb,
    items                   JSONB        DEFAULT '[]'::jsonb,
    product_type            TEXT,
    base_type               TEXT,
    color                   TEXT,
    barcode                 TEXT,
    substitute_product_code TEXT,
    expedition_items        JSONB        DEFAULT '[]'::jsonb,
    is_volatile_infinite    BOOLEAN      DEFAULT FALSE,
    status                  TEXT         DEFAULT 'ATIVO',
    updated_at              TIMESTAMPTZ  DEFAULT NOW()
);

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='product_boms' AND column_name='product_sku')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='product_boms' AND column_name='code')
    THEN
        ALTER TABLE product_boms RENAME COLUMN product_sku TO code;
    END IF;
END $$;

ALTER TABLE product_boms
    ADD COLUMN IF NOT EXISTS items                   JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS product_type            TEXT,
    ADD COLUMN IF NOT EXISTS base_type               TEXT,
    ADD COLUMN IF NOT EXISTS color                   TEXT,
    ADD COLUMN IF NOT EXISTS barcode                 TEXT,
    ADD COLUMN IF NOT EXISTS substitute_product_code TEXT,
    ADD COLUMN IF NOT EXISTS expedition_items        JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS is_volatile_infinite    BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS reserved_qty            REAL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS ready_qty               REAL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS description             TEXT,
    ADD COLUMN IF NOT EXISTS status                  TEXT DEFAULT 'ATIVO',
    ADD COLUMN IF NOT EXISTS updated_at              TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_product_boms_code ON product_boms (code);
CREATE INDEX IF NOT EXISTS idx_product_boms_kind ON product_boms (kind);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. orders
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
    id                          TEXT             PRIMARY KEY,
    order_id                    TEXT             NOT NULL,
    bling_numero                TEXT,
    tracking                    TEXT,
    tracking_code               TEXT,              -- v7: código de rastreio auxiliar
    sku                         TEXT             NOT NULL DEFAULT '',
    qty_original                INT              NOT NULL DEFAULT 1,
    multiplicador               INT              DEFAULT 1,
    qty_final                   INT              NOT NULL DEFAULT 1,
    color                       TEXT,
    canal                       TEXT,
    data                        TEXT,
    data_prevista_envio         TEXT,
    status                      order_status_value DEFAULT 'NORMAL',
    customer_name               TEXT,
    customer_cpf_cnpj           TEXT,
    price_gross                 REAL             DEFAULT 0,
    price_total                 REAL             DEFAULT 0,
    platform_fees               REAL             DEFAULT 0,
    shipping_fee                REAL             DEFAULT 0,
    shipping_paid_by_customer   REAL             DEFAULT 0,
    price_net                   REAL             DEFAULT 0,
    error_reason                TEXT,
    resolution_details          JSONB,
    vinculado_bling             BOOLEAN          DEFAULT FALSE,
    etiqueta_gerada             BOOLEAN          DEFAULT FALSE,
    lote_id                     TEXT,
    id_pedido_loja              TEXT,
    venda_origem                TEXT,
    numero_pedido_loja          TEXT,
    id_bling                    TEXT,
    situacao_id                 INT,
    situacao_valor              TEXT,
    loja_id                     TEXT,
    loja_nome                   TEXT,
    loja                        TEXT,              -- v7: nome de loja genérico (TS OrderItem.loja)
    descontar_volatil           BOOLEAN DEFAULT FALSE,  -- v7: flag para desconto volátil na bipagem
    plataforma_origem           TEXT,              -- v7: plataforma de origem (Bling sync)
    data_expiracao              TEXT,              -- v7: data expiração do pedido
    created_at                  TIMESTAMPTZ      DEFAULT NOW()
);

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS bling_numero              TEXT,
    ADD COLUMN IF NOT EXISTS vinculado_bling            BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS etiqueta_gerada            BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS lote_id                    TEXT,
    ADD COLUMN IF NOT EXISTS id_pedido_loja             TEXT,
    ADD COLUMN IF NOT EXISTS venda_origem               TEXT,
    ADD COLUMN IF NOT EXISTS numero_pedido_loja         TEXT,
    ADD COLUMN IF NOT EXISTS id_bling                   TEXT,
    ADD COLUMN IF NOT EXISTS situacao_id                INT,
    ADD COLUMN IF NOT EXISTS situacao_valor             TEXT,
    ADD COLUMN IF NOT EXISTS loja_id                    TEXT,
    ADD COLUMN IF NOT EXISTS loja_nome                  TEXT,
    ADD COLUMN IF NOT EXISTS data_prevista_envio        TEXT,
    ADD COLUMN IF NOT EXISTS resolution_details         JSONB,
    ADD COLUMN IF NOT EXISTS shipping_paid_by_customer  REAL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS price_total                REAL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS tracking_code              TEXT,
    ADD COLUMN IF NOT EXISTS loja                       TEXT,
    ADD COLUMN IF NOT EXISTS descontar_volatil          BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS plataforma_origem          TEXT,
    ADD COLUMN IF NOT EXISTS data_expiracao             TEXT;

-- v8: Dropar views que dependem de orders.canal antes de converter o tipo
DROP VIEW IF EXISTS v_orders_status CASCADE;
DROP VIEW IF EXISTS vw_dados_analiticos CASCADE;

-- v8: Converter orders.canal de canal_type ENUM para TEXT (suporta canais customizados)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'orders'
          AND column_name = 'canal'
          AND udt_name = 'canal_type'
    ) THEN
        ALTER TABLE orders ALTER COLUMN canal TYPE TEXT USING canal::TEXT;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS orders_order_id_sku_idx ON orders (order_id, sku);
CREATE INDEX IF NOT EXISTS idx_orders_order_id  ON orders (order_id);
CREATE INDEX IF NOT EXISTS idx_orders_tracking  ON orders (tracking);
CREATE INDEX IF NOT EXISTS idx_orders_status    ON orders (status);
DROP INDEX IF EXISTS idx_orders_canal;
CREATE INDEX IF NOT EXISTS idx_orders_canal     ON orders (canal);
CREATE INDEX IF NOT EXISTS idx_orders_data      ON orders (data);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. scan_logs
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scan_logs (
    id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    scanned_at  TIMESTAMPTZ  DEFAULT NOW(),
    user_id     TEXT,
    user_name   TEXT,
    device      TEXT,
    display_key TEXT,
    status      TEXT,
    synced      BOOLEAN      DEFAULT FALSE,
    canal       TEXT,
    order_id    TEXT,
    sku         TEXT,
    notes       TEXT
);

ALTER TABLE scan_logs
    ADD COLUMN IF NOT EXISTS order_id TEXT,
    ADD COLUMN IF NOT EXISTS sku      TEXT,
    ADD COLUMN IF NOT EXISTS notes    TEXT;

CREATE INDEX IF NOT EXISTS idx_scan_logs_display_key ON scan_logs (display_key);
CREATE INDEX IF NOT EXISTS idx_scan_logs_scanned_at  ON scan_logs (scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_scan_logs_status      ON scan_logs (status);
CREATE INDEX IF NOT EXISTS idx_scan_logs_synced      ON scan_logs (synced) WHERE synced = FALSE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. sku_links
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sku_links (
    imported_sku       TEXT         PRIMARY KEY,
    master_product_sku TEXT         NOT NULL,
    created_at         TIMESTAMPTZ  DEFAULT NOW()
);

ALTER TABLE sku_links ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_sku_links_master ON sku_links (master_product_sku);

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. weighing_batches
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS weighing_batches (
    id                   UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    stock_item_code      TEXT         NOT NULL,
    stock_item_name      TEXT         NOT NULL DEFAULT '',
    initial_qty          REAL         NOT NULL DEFAULT 0,
    used_qty             REAL         DEFAULT 0,
    weighing_type        TEXT         DEFAULT 'daily',
    created_by_id        TEXT,
    created_by_name      TEXT,
    product_code         TEXT,
    qty_produced         REAL,
    operador_maquina     TEXT,
    operador_batedor     TEXT,
    quantidade_batedor   NUMERIC,
    com_cor              BOOLEAN      DEFAULT FALSE,
    tipo_operacao        TEXT         DEFAULT 'ENSACAMENTO',
    equipe_mistura       TEXT,
    destino              TEXT,
    base_sku             TEXT,
    batch_name           TEXT,
    produtos             JSONB        DEFAULT '[]'::jsonb,
    created_at           TIMESTAMPTZ  DEFAULT NOW()
);

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='weighing_batches' AND column_name='user_id')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='weighing_batches' AND column_name='created_by_id')
    THEN
        ALTER TABLE weighing_batches RENAME COLUMN user_id TO created_by_id;
    END IF;
END $$;

ALTER TABLE weighing_batches
    ADD COLUMN IF NOT EXISTS product_code       TEXT,
    ADD COLUMN IF NOT EXISTS qty_produced       REAL,
    ADD COLUMN IF NOT EXISTS operador_maquina   TEXT,
    ADD COLUMN IF NOT EXISTS operador_batedor   TEXT,
    ADD COLUMN IF NOT EXISTS quantidade_batedor NUMERIC,
    ADD COLUMN IF NOT EXISTS com_cor            BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS tipo_operacao      TEXT DEFAULT 'ENSACAMENTO',
    ADD COLUMN IF NOT EXISTS equipe_mistura     TEXT,
    ADD COLUMN IF NOT EXISTS destino            TEXT,
    ADD COLUMN IF NOT EXISTS base_sku           TEXT,
    ADD COLUMN IF NOT EXISTS batch_name         TEXT,
    ADD COLUMN IF NOT EXISTS produtos           JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_weighing_item_code  ON weighing_batches (stock_item_code);
CREATE INDEX IF NOT EXISTS idx_weighing_created_at ON weighing_batches (created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. grinding_batches
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS grinding_batches (
    id                    UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_insumo_code    TEXT         NOT NULL,
    source_insumo_name    TEXT,
    source_qty_used       REAL         NOT NULL DEFAULT 0,
    output_insumo_code    TEXT         NOT NULL,
    output_insumo_name    TEXT,
    output_qty_produced   REAL         NOT NULL DEFAULT 0,
    mode                  TEXT,
    user_id               TEXT,
    user_name             TEXT,
    batch_name            TEXT,        -- v7: nome do lote de moagem
    created_at            TIMESTAMPTZ  DEFAULT NOW()
);

ALTER TABLE grinding_batches
    ADD COLUMN IF NOT EXISTS batch_name TEXT;

CREATE INDEX IF NOT EXISTS idx_grinding_source_code ON grinding_batches (source_insumo_code);
CREATE INDEX IF NOT EXISTS idx_grinding_created_at  ON grinding_batches (created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. production_plans
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS production_plans (
    id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT         NOT NULL,
    status      TEXT         DEFAULT 'Draft',
    parameters  JSONB,
    plan_date   TEXT,
    created_by  TEXT,
    created_at  TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prod_plans_created_at ON production_plans (created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. production_plan_items
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS production_plan_items (
    id                     UUID  PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_id                UUID  NOT NULL REFERENCES production_plans(id) ON DELETE CASCADE,
    product_sku            TEXT,
    product_name           TEXT,
    current_stock          REAL,
    avg_daily_consumption  REAL,
    forecasted_demand      REAL,
    required_production    REAL
);

CREATE INDEX IF NOT EXISTS idx_plan_items_plan_id ON production_plan_items (plan_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 13. shopping_list_items
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shopping_list_items (
    stock_item_code TEXT         PRIMARY KEY,
    name            TEXT         NOT NULL DEFAULT '',
    quantity        REAL         NOT NULL DEFAULT 0,
    unit            TEXT         NOT NULL DEFAULT 'un',
    is_purchased    BOOLEAN      DEFAULT FALSE,
    created_at      TIMESTAMPTZ  DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 14. import_history
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS import_history (
    id             UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_name      TEXT,
    processed_at   TIMESTAMPTZ,
    user_name      TEXT,
    item_count     INT,
    unlinked_count INT,
    canal          TEXT,
    processed_data JSONB
);

CREATE INDEX IF NOT EXISTS idx_import_history_processed_at ON import_history (processed_at DESC);
CREATE INDEX IF NOT EXISTS idx_import_history_canal        ON import_history (canal);

-- ─────────────────────────────────────────────────────────────────────────────
-- 15. etiquetas_historico
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS etiquetas_historico (
    id                UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at        TIMESTAMPTZ  DEFAULT NOW(),
    created_by_name   TEXT,
    page_count        INT,
    zpl_content       TEXT,
    settings_snapshot JSONB,
    page_hashes       TEXT[]       DEFAULT '{}',
    lote_id           TEXT,
    canal             TEXT,
    total             INT          DEFAULT 0,
    geradas           INT          DEFAULT 0,
    erros             INT          DEFAULT 0,
    data              JSONB        DEFAULT '{}'::jsonb
);

ALTER TABLE etiquetas_historico
    ADD COLUMN IF NOT EXISTS lote_id TEXT,
    ADD COLUMN IF NOT EXISTS canal   TEXT,
    ADD COLUMN IF NOT EXISTS total   INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS geradas INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS erros   INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS data    JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_etiquetas_hist_created_at ON etiquetas_historico (created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 16. returns
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS returns (
    id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    tracking        TEXT         NOT NULL,
    customer_name   TEXT,
    logged_by_id    TEXT,
    logged_by_name  TEXT,
    order_id        TEXT,
    logged_at       TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_returns_tracking  ON returns (tracking);
CREATE INDEX IF NOT EXISTS idx_returns_logged_at ON returns (logged_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 17. admin_notices
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_notices (
    id         TEXT         PRIMARY KEY,
    text       TEXT         NOT NULL,
    level      TEXT         NOT NULL DEFAULT 'green',
    type       TEXT         NOT NULL DEFAULT 'banner',
    created_by TEXT,
    created_at TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notices_created_at ON admin_notices (created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 18. stock_pack_groups
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_pack_groups (
    id                  UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    name                TEXT         NOT NULL,
    barcode             TEXT,
    item_codes          TEXT[]       NOT NULL DEFAULT '{}',
    final_product_code  TEXT,
    min_pack_qty        REAL         NOT NULL DEFAULT 0,
    tipo                TEXT         DEFAULT 'tradicional',
    quantidade_volatil  NUMERIC      DEFAULT 0,
    localizacao         TEXT,
    pallet              TEXT,
    galpao              TEXT,
    com_desempenadeira  BOOLEAN      DEFAULT FALSE,
    pack_size           REAL,        -- v7: tamanho do pacote
    created_at          TIMESTAMPTZ  DEFAULT NOW()
);

ALTER TABLE stock_pack_groups
    ADD COLUMN IF NOT EXISTS barcode            TEXT,
    ADD COLUMN IF NOT EXISTS final_product_code TEXT,
    ADD COLUMN IF NOT EXISTS tipo               TEXT DEFAULT 'tradicional',
    ADD COLUMN IF NOT EXISTS quantidade_volatil NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS localizacao        TEXT,
    ADD COLUMN IF NOT EXISTS pallet             TEXT,
    ADD COLUMN IF NOT EXISTS galpao             TEXT,
    ADD COLUMN IF NOT EXISTS com_desempenadeira BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS pack_size          REAL;

CREATE INDEX IF NOT EXISTS idx_pack_groups_name ON stock_pack_groups (name);

-- ─────────────────────────────────────────────────────────────────────────────
-- 19. estoque_pronto
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS estoque_pronto (
    id                    UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id              TEXT         NOT NULL DEFAULT '',
    stock_item_id         TEXT         NOT NULL DEFAULT '',
    stock_item_code       TEXT,
    stock_item_name       TEXT,
    lote_numero           TEXT,
    quantidade_total      NUMERIC      DEFAULT 0,
    quantidade_disponivel NUMERIC      DEFAULT 0,
    localizacao           TEXT,
    status                TEXT         DEFAULT 'PRONTO',
    observacoes           TEXT,
    produtos              JSONB        DEFAULT '[]'::jsonb,
    created_by            TEXT,
    barcode               TEXT,
    pallet                TEXT,
    galpao                TEXT,
    com_desempenadeira    BOOLEAN      DEFAULT FALSE,
    created_at            TIMESTAMPTZ  DEFAULT NOW(),
    updated_at            TIMESTAMPTZ  DEFAULT NOW()
);

ALTER TABLE estoque_pronto
    ADD COLUMN IF NOT EXISTS stock_item_code    TEXT,
    ADD COLUMN IF NOT EXISTS stock_item_name    TEXT,
    ADD COLUMN IF NOT EXISTS lote_numero        TEXT,
    ADD COLUMN IF NOT EXISTS barcode            TEXT,
    ADD COLUMN IF NOT EXISTS pallet             TEXT,
    ADD COLUMN IF NOT EXISTS galpao             TEXT,
    ADD COLUMN IF NOT EXISTS com_desempenadeira BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_estoque_pronto_barcode ON estoque_pronto (barcode);
CREATE INDEX IF NOT EXISTS idx_estoque_pronto_status  ON estoque_pronto (status);
CREATE INDEX IF NOT EXISTS idx_estoque_pronto_sku     ON estoque_pronto (stock_item_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 20. order_items  (REFORMULADO v7 — suporta Bling + ML + Shopee + TikTok)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_items (
    id                     TEXT         PRIMARY KEY DEFAULT gen_random_uuid()::text,
    order_id               TEXT         NOT NULL,
    bling_id               TEXT,
    bling_item_id          TEXT,          -- v7: Bling item ID para upsert
    item_id                TEXT,          -- v7: marketplace item ID para upsert
    canal                  TEXT,          -- v7: ML, SHOPEE, TIKTOK, BLING
    sku                    TEXT         NOT NULL DEFAULT '',
    nome                   TEXT,
    descricao              TEXT,          -- v7: descrição do item (syncBlingItems / marketplace)
    unidade                TEXT,          -- v7: unidade de medida (syncBlingItems)
    quantidade             NUMERIC      DEFAULT 1,
    preco_unitario         NUMERIC      DEFAULT 0,
    valor_unitario         NUMERIC      DEFAULT 0,  -- v7: alias usado por marketplace sync
    preco_total            NUMERIC      DEFAULT 0,
    subtotal               NUMERIC      DEFAULT 0,  -- v7: alias usado por marketplace sync
    status                 TEXT         DEFAULT 'nao_sincronizado',
    data_criacao           TIMESTAMPTZ  DEFAULT NOW(),
    ultima_sincronizacao   TIMESTAMPTZ,
    sincronizado_em        TIMESTAMPTZ,    -- v7: timestamp de sync (marketplace)
    erro_mensagem          TEXT
);

-- Migração: adicionar colunas novas se tabela já existia
ALTER TABLE order_items
    ADD COLUMN IF NOT EXISTS bling_item_id    TEXT,
    ADD COLUMN IF NOT EXISTS item_id          TEXT,
    ADD COLUMN IF NOT EXISTS canal            TEXT,
    ADD COLUMN IF NOT EXISTS descricao        TEXT,
    ADD COLUMN IF NOT EXISTS unidade          TEXT,
    ADD COLUMN IF NOT EXISTS valor_unitario   NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS subtotal         NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS sincronizado_em  TIMESTAMPTZ;

-- Unique constraints para upserts
CREATE UNIQUE INDEX IF NOT EXISTS idx_order_items_bling_upsert
    ON order_items (bling_item_id, order_id) WHERE bling_item_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_order_items_marketplace_upsert
    ON order_items (item_id, order_id) WHERE item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_order_items_o_id ON order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_sku  ON order_items (sku);
CREATE INDEX IF NOT EXISTS idx_order_items_canal ON order_items (canal);

-- ─────────────────────────────────────────────────────────────────────────────
-- 21. setores
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS setores (
    id             UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    name           TEXT         UNIQUE NOT NULL,
    allowed_pages  TEXT[]       DEFAULT '{}',
    created_at     TIMESTAMPTZ  DEFAULT NOW()
);

ALTER TABLE setores
    ADD COLUMN IF NOT EXISTS allowed_pages TEXT[] DEFAULT '{}';

-- ─────────────────────────────────────────────────────────────────────────────
-- 22. etiquetas_prioritarias
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS etiquetas_prioritarias (
    id                     UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    pedido_id              TEXT         NOT NULL,
    numero_bling           TEXT         NOT NULL,
    nfe_lote               TEXT         NOT NULL,
    data_geracao           TIMESTAMPTZ  DEFAULT now(),
    status_processamento   TEXT         NOT NULL DEFAULT 'pendente'
        CHECK (status_processamento IN ('pendente', 'processando', 'concluido', 'salvo_no_pc', 'erro')),
    armazenagem            TEXT         NOT NULL DEFAULT 'zpl'
        CHECK (armazenagem IN ('zpl', 'pc')),
    conteudo_zpl           TEXT,
    conteudo_txt           TEXT,
    caminho_arquivo        TEXT,
    rastreabilidade        JSONB        NOT NULL DEFAULT '{}'::jsonb,
    metadados              JSONB        DEFAULT '{}'::jsonb,
    criado_por             TEXT,
    atualizado_em          TIMESTAMPTZ  DEFAULT now(),
    atualizado_por         TEXT,
    CONSTRAINT etiquetas_prioritarias_num_nfe_uq UNIQUE (numero_bling, nfe_lote)
);

CREATE INDEX IF NOT EXISTS idx_etiquetas_nfe_lote      ON etiquetas_prioritarias (nfe_lote);
CREATE INDEX IF NOT EXISTS idx_etiquetas_numero_bling   ON etiquetas_prioritarias (numero_bling);
CREATE INDEX IF NOT EXISTS idx_etiquetas_pedido_id      ON etiquetas_prioritarias (pedido_id);
CREATE INDEX IF NOT EXISTS idx_etiquetas_status         ON etiquetas_prioritarias (status_processamento);
CREATE INDEX IF NOT EXISTS idx_etiquetas_armazenagem    ON etiquetas_prioritarias (armazenagem);
CREATE INDEX IF NOT EXISTS idx_etiquetas_data_geracao   ON etiquetas_prioritarias (data_geracao DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 23. bling_nfe
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bling_nfe (
    id                   TEXT         PRIMARY KEY,
    bling_id             TEXT         NOT NULL,
    numero               TEXT,
    serie                TEXT,
    situacao             INT,
    situacao_descricao   TEXT,
    data_emissao         TIMESTAMPTZ,
    valor_total          NUMERIC      DEFAULT 0,
    chave_acesso         TEXT,
    link_danfe           TEXT,
    cliente_nome         TEXT,
    cliente_doc          TEXT,
    id_venda             TEXT,
    id_loja_virtual      TEXT,
    canal_nome           TEXT,
    tipo                 INT          DEFAULT 1,
    last_sync            TIMESTAMPTZ  DEFAULT NOW(),
    created_at           TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bling_nfe_bling_id  ON bling_nfe (bling_id);
CREATE INDEX IF NOT EXISTS idx_bling_nfe_id_venda  ON bling_nfe (id_venda);
CREATE INDEX IF NOT EXISTS idx_bling_nfe_chave     ON bling_nfe (chave_acesso);

-- ─────────────────────────────────────────────────────────────────────────────
-- 24. bling_lotes_nfe
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bling_lotes_nfe (
    id        TEXT         PRIMARY KEY,
    tipo      TEXT         NOT NULL DEFAULT 'GERACAO_APENAS',
    total     INTEGER      DEFAULT 0,
    ok        INTEGER      DEFAULT 0,
    fail      INTEGER      DEFAULT 0,
    nfes      JSONB        DEFAULT '[]',
    criado_em TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lotes_nfe_criado_em ON bling_lotes_nfe (criado_em DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 25. nfes (NF-e próprias) — TABELA FISCAL PRINCIPAL
--     Usa camelCase quoted conforme nfeSupabase.ts
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nfes (
    id                    UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    numero                TEXT            NOT NULL,
    serie                 TEXT            NOT NULL,
    emissao               BIGINT          NOT NULL,
    cliente               JSONB           NOT NULL DEFAULT '{}',
    valor                 DECIMAL(18,2)   NOT NULL,
    "pedidoId"            TEXT,
    status                nfe_status      DEFAULT 'RASCUNHO',
    "chaveAcesso"         TEXT            UNIQUE,
    "xmlOriginal"         TEXT,
    "xmlAssinado"         TEXT,
    "sefazEnvio"          JSONB           DEFAULT '{}',
    "certificadoUsado"    JSONB,
    "tentativasEnvio"     INT             DEFAULT 0,
    "erroDetalhes"        JSONB,
    "criadoEm"            BIGINT          NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
    "atualizadoEm"        BIGINT          NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
    UNIQUE(numero, serie)
);

-- *** MIGRAÇÃO: se a tabela nfes já existia com colunas LOWERCASE, renomeia para camelCase ***
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='nfes' AND column_name='pedidoid')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='nfes' AND column_name='pedidoId')
    THEN ALTER TABLE nfes RENAME COLUMN pedidoid TO "pedidoId"; END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='nfes' AND column_name='chaveacesso')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='nfes' AND column_name='chaveAcesso')
    THEN ALTER TABLE nfes RENAME COLUMN chaveacesso TO "chaveAcesso"; END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='nfes' AND column_name='xmloriginal')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='nfes' AND column_name='xmlOriginal')
    THEN ALTER TABLE nfes RENAME COLUMN xmloriginal TO "xmlOriginal"; END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='nfes' AND column_name='xmlassinado')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='nfes' AND column_name='xmlAssinado')
    THEN ALTER TABLE nfes RENAME COLUMN xmlassinado TO "xmlAssinado"; END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='nfes' AND column_name='sefazenvio')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='nfes' AND column_name='sefazEnvio')
    THEN ALTER TABLE nfes RENAME COLUMN sefazenvio TO "sefazEnvio"; END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='nfes' AND column_name='certificadousado')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='nfes' AND column_name='certificadoUsado')
    THEN ALTER TABLE nfes RENAME COLUMN certificadousado TO "certificadoUsado"; END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='nfes' AND column_name='criadoem')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='nfes' AND column_name='criadoEm')
    THEN ALTER TABLE nfes RENAME COLUMN criadoem TO "criadoEm"; END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='nfes' AND column_name='atualizadoem')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='nfes' AND column_name='atualizadoEm')
    THEN ALTER TABLE nfes RENAME COLUMN atualizadoem TO "atualizadoEm"; END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='nfes' AND column_name='tentativasenvio')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='nfes' AND column_name='tentativasEnvio')
    THEN ALTER TABLE nfes RENAME COLUMN tentativasenvio TO "tentativasEnvio"; END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='nfes' AND column_name='errodetalhes')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='nfes' AND column_name='erroDetalhes')
    THEN ALTER TABLE nfes RENAME COLUMN errodetalhes TO "erroDetalhes"; END IF;
END $$;

-- *** LIMPEZA v7: dropar colunas snake_case duplicadas se camelCase já existe ***
DO $$ BEGIN
    -- Se ambos pedido_id e "pedidoId" existem, dropar pedido_id
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='nfes' AND column_name='pedido_id')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='nfes' AND column_name='pedidoId')
    THEN
        -- Migrar dados de pedido_id para "pedidoId" se "pedidoId" estiver vazio
        UPDATE nfes SET "pedidoId" = pedido_id WHERE "pedidoId" IS NULL AND pedido_id IS NOT NULL;
        ALTER TABLE nfes DROP COLUMN pedido_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='nfes' AND column_name='chave_acesso')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='nfes' AND column_name='chaveAcesso')
    THEN
        UPDATE nfes SET "chaveAcesso" = chave_acesso WHERE "chaveAcesso" IS NULL AND chave_acesso IS NOT NULL;
        ALTER TABLE nfes DROP COLUMN chave_acesso;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='nfes' AND column_name='xml_original')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='nfes' AND column_name='xmlOriginal')
    THEN
        UPDATE nfes SET "xmlOriginal" = xml_original WHERE "xmlOriginal" IS NULL AND xml_original IS NOT NULL;
        ALTER TABLE nfes DROP COLUMN xml_original;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='nfes' AND column_name='xml_assinado')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='nfes' AND column_name='xmlAssinado')
    THEN
        UPDATE nfes SET "xmlAssinado" = xml_assinado WHERE "xmlAssinado" IS NULL AND xml_assinado IS NOT NULL;
        ALTER TABLE nfes DROP COLUMN xml_assinado;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='nfes' AND column_name='sefaz_envio')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='nfes' AND column_name='sefazEnvio')
    THEN
        UPDATE nfes SET "sefazEnvio" = sefaz_envio::jsonb WHERE "sefazEnvio" IS NULL AND sefaz_envio IS NOT NULL;
        ALTER TABLE nfes DROP COLUMN sefaz_envio;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='nfes' AND column_name='certificado_usado')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='nfes' AND column_name='certificadoUsado')
    THEN
        UPDATE nfes SET "certificadoUsado" = certificado_usado::jsonb WHERE "certificadoUsado" IS NULL AND certificado_usado IS NOT NULL;
        ALTER TABLE nfes DROP COLUMN certificado_usado;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='nfes' AND column_name='tentativas_envio')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='nfes' AND column_name='tentativasEnvio')
    THEN
        UPDATE nfes SET "tentativasEnvio" = tentativas_envio::int WHERE "tentativasEnvio" IS NULL AND tentativas_envio IS NOT NULL;
        ALTER TABLE nfes DROP COLUMN tentativas_envio;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='nfes' AND column_name='erro_detalhes')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='nfes' AND column_name='erroDetalhes')
    THEN
        UPDATE nfes SET "erroDetalhes" = erro_detalhes::jsonb WHERE "erroDetalhes" IS NULL AND erro_detalhes IS NOT NULL;
        ALTER TABLE nfes DROP COLUMN erro_detalhes;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='nfes' AND column_name='created_at')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='nfes' AND column_name='criadoEm')
    THEN
        ALTER TABLE nfes DROP COLUMN IF EXISTS created_at;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='nfes' AND column_name='updated_at')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='nfes' AND column_name='atualizadoEm')
    THEN
        ALTER TABLE nfes DROP COLUMN IF EXISTS updated_at;
    END IF;
END $$;

-- Garantir que TODAS as colunas camelCase existem
ALTER TABLE nfes ADD COLUMN IF NOT EXISTS "pedidoId"         TEXT;
ALTER TABLE nfes ADD COLUMN IF NOT EXISTS "chaveAcesso"      TEXT;
ALTER TABLE nfes ADD COLUMN IF NOT EXISTS "xmlOriginal"      TEXT;
ALTER TABLE nfes ADD COLUMN IF NOT EXISTS "xmlAssinado"      TEXT;
ALTER TABLE nfes ADD COLUMN IF NOT EXISTS "sefazEnvio"       JSONB DEFAULT '{}';
ALTER TABLE nfes ADD COLUMN IF NOT EXISTS "certificadoUsado" JSONB;
ALTER TABLE nfes ADD COLUMN IF NOT EXISTS "tentativasEnvio"  INT DEFAULT 0;
ALTER TABLE nfes ADD COLUMN IF NOT EXISTS "erroDetalhes"     JSONB;
ALTER TABLE nfes ADD COLUMN IF NOT EXISTS "criadoEm"         BIGINT;
ALTER TABLE nfes ADD COLUMN IF NOT EXISTS "atualizadoEm"     BIGINT;

CREATE INDEX IF NOT EXISTS idx_nfes_status      ON nfes (status);
CREATE INDEX IF NOT EXISTS idx_nfes_pedidoId    ON nfes ("pedidoId");
CREATE INDEX IF NOT EXISTS idx_nfes_chaveAcesso ON nfes ("chaveAcesso");
CREATE INDEX IF NOT EXISTS idx_nfes_criadoEm    ON nfes ("criadoEm" DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 26. certificados — TABELA FISCAL
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS certificados (
    id                      TEXT     PRIMARY KEY,
    nome                    TEXT,
    cnpj                    TEXT     NOT NULL,
    tipo                    TEXT     NOT NULL DEFAULT 'A1',
    issuer                  TEXT,
    subject                 TEXT,
    valido                  BOOLEAN  DEFAULT TRUE,
    "dataInicio"            BIGINT,
    "dataValidade"          BIGINT   NOT NULL,
    thumbprint              TEXT     UNIQUE NOT NULL,
    "algoritmoAssinatura"   TEXT,
    "certificadoPem"        TEXT     NOT NULL,
    "chavePem"              TEXT     NOT NULL,
    erros                   JSONB    DEFAULT '[]'::jsonb,
    "criadoEm"              BIGINT   NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
    "atualizadoEm"          BIGINT   NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000)
);

-- *** MIGRAÇÃO certificados lowercase → camelCase ***
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='certificados' AND column_name='datainicio')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='certificados' AND column_name='dataInicio')
    THEN ALTER TABLE certificados RENAME COLUMN datainicio TO "dataInicio"; END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='certificados' AND column_name='datavalidade')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='certificados' AND column_name='dataValidade')
    THEN ALTER TABLE certificados RENAME COLUMN datavalidade TO "dataValidade"; END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='certificados' AND column_name='algoritmoassinatura')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='certificados' AND column_name='algoritmoAssinatura')
    THEN ALTER TABLE certificados RENAME COLUMN algoritmoassinatura TO "algoritmoAssinatura"; END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='certificados' AND column_name='certificadopem')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='certificados' AND column_name='certificadoPem')
    THEN ALTER TABLE certificados RENAME COLUMN certificadopem TO "certificadoPem"; END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='certificados' AND column_name='chavepem')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='certificados' AND column_name='chavePem')
    THEN ALTER TABLE certificados RENAME COLUMN chavepem TO "chavePem"; END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='certificados' AND column_name='criadoem')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='certificados' AND column_name='criadoEm')
    THEN ALTER TABLE certificados RENAME COLUMN criadoem TO "criadoEm"; END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='certificados' AND column_name='atualizadoem')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='certificados' AND column_name='atualizadoEm')
    THEN ALTER TABLE certificados RENAME COLUMN atualizadoem TO "atualizadoEm"; END IF;
END $$;

ALTER TABLE certificados ADD COLUMN IF NOT EXISTS "dataInicio"          BIGINT;
ALTER TABLE certificados ADD COLUMN IF NOT EXISTS "dataValidade"        BIGINT;
ALTER TABLE certificados ADD COLUMN IF NOT EXISTS "algoritmoAssinatura" TEXT;
ALTER TABLE certificados ADD COLUMN IF NOT EXISTS "certificadoPem"      TEXT;
ALTER TABLE certificados ADD COLUMN IF NOT EXISTS "chavePem"            TEXT;
ALTER TABLE certificados ADD COLUMN IF NOT EXISTS "criadoEm"            BIGINT;
ALTER TABLE certificados ADD COLUMN IF NOT EXISTS "atualizadoEm"        BIGINT;

CREATE INDEX IF NOT EXISTS idx_certificados_cnpj          ON certificados (cnpj);
CREATE INDEX IF NOT EXISTS idx_certificados_thumbprint     ON certificados (thumbprint);
CREATE INDEX IF NOT EXISTS idx_certificados_valido         ON certificados (valido);
CREATE INDEX IF NOT EXISTS idx_certificados_dataValidade   ON certificados ("dataValidade" DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 27. objetos_postagem
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS objetos_postagem (
    id                      BIGSERIAL       PRIMARY KEY,
    bling_id                TEXT,
    nfe_id                  BIGINT,
    nfe_numero              TEXT,
    numero_pedido_loja      TEXT,
    destinatario            TEXT,
    rastreio                TEXT,
    servico                 TEXT,
    transportadora          TEXT,
    situacao                TEXT             DEFAULT 'Pendente',
    valor_nota              DECIMAL(18,2)    DEFAULT 0,
    data_criacao            TEXT,
    prazo_entrega           TEXT,
    dimensoes               JSONB            DEFAULT '{}',
    dados_bling             JSONB            DEFAULT '{}',
    created_at              TIMESTAMPTZ      DEFAULT NOW(),
    updated_at              TIMESTAMPTZ      DEFAULT NOW(),
    UNIQUE(bling_id)
);

CREATE INDEX IF NOT EXISTS idx_objetos_postagem_nfe_id         ON objetos_postagem (nfe_id);
CREATE INDEX IF NOT EXISTS idx_objetos_postagem_rastreio       ON objetos_postagem (rastreio);
CREATE INDEX IF NOT EXISTS idx_objetos_postagem_numero_pedido  ON objetos_postagem (numero_pedido_loja);
CREATE INDEX IF NOT EXISTS idx_objetos_postagem_created        ON objetos_postagem (created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 28. audit_logs  (v7: suporta 2 esquemas de inserção)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp    TIMESTAMPTZ  DEFAULT NOW(),
    usuario      TEXT,
    usuario_id   TEXT,          -- v7: usado por danfeSimplificadoComEtiquetaService
    acao         TEXT         NOT NULL,
    descricao    TEXT,          -- v7: usado por danfeSimplificadoComEtiquetaService
    modulo       TEXT,
    tipo         TEXT,
    resultado    TEXT         DEFAULT 'sucesso',
    dados        JSONB        DEFAULT '{}'::jsonb,
    erro         JSONB,
    duracao_ms   INT,
    criado_em    TIMESTAMPTZ,  -- v7: usado por danfeSimplificadoComEtiquetaService
    created_at   TIMESTAMPTZ  DEFAULT NOW()
);

ALTER TABLE audit_logs
    ADD COLUMN IF NOT EXISTS usuario_id TEXT,
    ADD COLUMN IF NOT EXISTS descricao  TEXT,
    ADD COLUMN IF NOT EXISTS criado_em  TIMESTAMPTZ;

-- Tornar colunas opcionais que não são usadas por todos os schemas
DO $$ BEGIN
    -- modulo e tipo eram NOT NULL no v6, mas danfeService não os envia
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='audit_logs' AND column_name='modulo' AND is_nullable='NO'
    ) THEN
        ALTER TABLE audit_logs ALTER COLUMN modulo DROP NOT NULL;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='audit_logs' AND column_name='tipo' AND is_nullable='NO'
    ) THEN
        ALTER TABLE audit_logs ALTER COLUMN tipo DROP NOT NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_audit_logs_modulo     ON audit_logs (modulo);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tipo       ON audit_logs (tipo);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 29. sync_config
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sync_config (
    chave      TEXT         PRIMARY KEY,
    valor      TEXT         NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ  DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 30. sync_log (NOVA v7 — logs de sincronização Bling)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sync_log (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo       TEXT,
    bling_id   TEXT,
    sucesso    BOOLEAN      DEFAULT TRUE,
    mensagem   TEXT,
    created_at TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_log_created_at ON sync_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_log_tipo       ON sync_log (tipo);

-- ─────────────────────────────────────────────────────────────────────────────
-- 31. skus_vinculados (DANFE → SKU Etiqueta)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS skus_vinculados (
    id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    "codigoDanfe"     TEXT         NOT NULL,
    "descricaoDanfe"  TEXT,
    "skuEtiqueta"     TEXT         NOT NULL,
    "skuPrincipal"    TEXT         NOT NULL,
    "nomeProduto"     TEXT,
    marketplace       TEXT,
    created_at        TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skus_vinculados_codigo   ON skus_vinculados ("codigoDanfe");
CREATE INDEX IF NOT EXISTS idx_skus_vinculados_sku      ON skus_vinculados ("skuPrincipal");

-- ─────────────────────────────────────────────────────────────────────────────
-- 32. cost_calculations
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cost_calculations (
    id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    product_sku          TEXT,
    product_name         TEXT,
    items                JSONB        DEFAULT '[]'::jsonb,
    selling_price        REAL         DEFAULT 0,
    platform_fee         REAL         DEFAULT 0,      -- v7: campo que TS escreve
    platform_fee_percent REAL         DEFAULT 0,      -- alias legado
    shipping_cost        REAL         DEFAULT 0,
    tax_percent          REAL         DEFAULT 0,
    other_costs          REAL         DEFAULT 0,
    calculation_type     TEXT,
    calculation_category TEXT,
    report_name          TEXT,
    selected_products    JSONB        DEFAULT '[]'::jsonb,
    total_material_cost  REAL         DEFAULT 0,
    profit               REAL         DEFAULT 0,
    margin               REAL         DEFAULT 0,
    created_by           TEXT,
    target_revenue       REAL,
    target_quantity      REAL,
    comparative_prices   JSONB,
    related_skus         JSONB,
    created_at           TIMESTAMPTZ  DEFAULT NOW(),
    updated_at           TIMESTAMPTZ  DEFAULT NOW()
);

ALTER TABLE cost_calculations
    ADD COLUMN IF NOT EXISTS platform_fee       REAL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS calculation_type   TEXT,
    ADD COLUMN IF NOT EXISTS calculation_category TEXT,
    ADD COLUMN IF NOT EXISTS report_name        TEXT,
    ADD COLUMN IF NOT EXISTS selected_products  JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS total_material_cost REAL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS profit             REAL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS margin             REAL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS created_by         TEXT,
    ADD COLUMN IF NOT EXISTS target_revenue     REAL,
    ADD COLUMN IF NOT EXISTS target_quantity    REAL,
    ADD COLUMN IF NOT EXISTS comparative_prices JSONB,
    ADD COLUMN IF NOT EXISTS related_skus       JSONB,
    ADD COLUMN IF NOT EXISTS updated_at         TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_cost_calc_sku ON cost_calculations (product_sku);

-- ─────────────────────────────────────────────────────────────────────────────
-- 33. purchase_planning (NOVA v7 — Planejamento de compras da calculadora)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_planning (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    project_name    TEXT,
    category        TEXT,
    product_sku     TEXT,
    related_skus    JSONB,
    items           JSONB        DEFAULT '[]'::jsonb,
    total_cost      REAL         DEFAULT 0,
    created_by      TEXT,
    created_at      TIMESTAMPTZ  DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchase_planning_sku ON purchase_planning (product_sku);

-- ─────────────────────────────────────────────────────────────────────────────
-- 34. zpl_batches (NOVA v7 — Lotes de etiquetas ZPL)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS zpl_batches (
    id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id         TEXT,
    description      TEXT,
    source           TEXT,          -- 'bling-notas', 'marketplace', 'individual', 'manual'
    label_count      INT          DEFAULT 0,
    zpl_content      TEXT,
    created_by_name  TEXT,
    created_at       TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_zpl_batches_created_at ON zpl_batches (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_zpl_batches_source     ON zpl_batches (source);

-- ═════════════════════════════════════════════════════════════════════════════
--  VIEWS
-- ═════════════════════════════════════════════════════════════════════════════

DROP VIEW IF EXISTS vw_dados_analiticos;
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

CREATE OR REPLACE VIEW etiquetas_por_lote AS
SELECT nfe_lote AS lote, COUNT(*) AS total_etiquetas,
    COUNT(*) FILTER (WHERE status_processamento = 'concluido') AS processadas,
    COUNT(*) FILTER (WHERE armazenagem = 'zpl') AS armazenadas_zpl,
    COUNT(*) FILTER (WHERE armazenagem = 'pc') AS salvas_pc,
    MAX(data_geracao) AS ultima_geracao
FROM etiquetas_prioritarias GROUP BY nfe_lote ORDER BY ultima_geracao DESC;

CREATE OR REPLACE VIEW etiquetas_por_canal AS
SELECT rastreabilidade->>'canalVendas' AS canal, COUNT(*) AS total_etiquetas,
    COUNT(*) FILTER (WHERE status_processamento = 'concluido') AS processadas,
    COUNT(DISTINCT numero_bling) AS pedidos_diferentes
FROM etiquetas_prioritarias GROUP BY rastreabilidade->>'canalVendas' ORDER BY total_etiquetas DESC;

-- ═════════════════════════════════════════════════════════════════════════════
--  TRIGGERS
-- ═════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

DO $$ DECLARE tbl TEXT; trg TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY['stock_items', 'app_settings', 'product_boms', 'estoque_pronto']
    LOOP
        trg := 'trg_' || tbl || '_updated_at';
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = trg) THEN
            EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()', trg, tbl);
        END IF;
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION atualizar_timestamp_etiquetas()
RETURNS TRIGGER AS $$ BEGIN NEW.atualizado_em = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_atualizar_timestamp_etiquetas ON etiquetas_prioritarias;
CREATE TRIGGER trigger_atualizar_timestamp_etiquetas
    BEFORE UPDATE ON etiquetas_prioritarias FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp_etiquetas();

-- ═════════════════════════════════════════════════════════════════════════════
--  ROW LEVEL SECURITY
-- ═════════════════════════════════════════════════════════════════════════════

DO $$ DECLARE tbl TEXT;
BEGIN
    FOR tbl IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "allow_all" ON public.%I', tbl);
        EXECUTE format('CREATE POLICY "allow_all" ON public.%I FOR ALL USING (true) WITH CHECK (true)', tbl);
    END LOOP;
END $$;

-- ═════════════════════════════════════════════════════════════════════════════
--  FUNÇÕES RPC
-- ═════════════════════════════════════════════════════════════════════════════

-- ── 1. login ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION login(login_input TEXT, password_input TEXT)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE found_user RECORD;
BEGIN
    SELECT * INTO found_user FROM public.users
    WHERE (lower(trim(COALESCE(name, ''))) = lower(trim(COALESCE(login_input, '')))
           OR lower(trim(COALESCE(email, ''))) = lower(trim(COALESCE(login_input, ''))))
      AND trim(COALESCE(password, '')) = trim(COALESCE(password_input, ''))
    LIMIT 1;
    IF found_user IS NOT NULL THEN RETURN to_jsonb(found_user); ELSE RETURN NULL; END IF;
END; $$;

-- ── 2. adjust_stock_quantity ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION adjust_stock_quantity(
    item_code TEXT, quantity_delta REAL, origin_text TEXT, ref_text TEXT, user_name TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_item_name TEXT;
BEGIN
    SELECT name INTO v_item_name FROM public.stock_items WHERE code = item_code;
    IF v_item_name IS NOT NULL THEN
        UPDATE public.stock_items SET current_qty = current_qty + quantity_delta, updated_at = NOW() WHERE code = item_code;
    ELSE
        SELECT name INTO v_item_name FROM public.product_boms WHERE code = item_code;
        IF v_item_name IS NOT NULL THEN
            UPDATE public.product_boms SET current_qty = current_qty + quantity_delta, updated_at = NOW() WHERE code = item_code;
        ELSE
            RAISE EXCEPTION 'Item not found: %', item_code;
        END IF;
    END IF;
    INSERT INTO public.stock_movements (stock_item_code, stock_item_name, origin, qty_delta, ref, created_by_name)
    VALUES (item_code, v_item_name, origin_text, quantity_delta, ref_text, user_name);
END; $$;

-- ── 3. deduct_bom_recursive ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION deduct_bom_recursive(
    p_sku TEXT, p_qty REAL, p_origin TEXT, p_ref TEXT, p_user_name TEXT
) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE v_bom_data JSONB; v_bom_item JSONB; v_comp_sku TEXT; v_comp_qty REAL;
BEGIN
    SELECT COALESCE(bom_composition->'items', items) INTO v_bom_data FROM public.product_boms WHERE code = p_sku;
    IF v_bom_data IS NOT NULL AND jsonb_array_length(v_bom_data) > 0 THEN
        FOR v_bom_item IN SELECT * FROM jsonb_array_elements(v_bom_data) LOOP
            v_comp_sku := COALESCE(v_bom_item->>'stockItemCode', v_bom_item->>'code');
            v_comp_qty := (v_bom_item->>'qty_per_pack')::REAL * p_qty;
            IF v_comp_sku IS NOT NULL THEN
                PERFORM public.deduct_bom_recursive(v_comp_sku, v_comp_qty, p_origin, p_ref, p_user_name);
            END IF;
        END LOOP;
    ELSE
        PERFORM public.adjust_stock_quantity(p_sku, -p_qty, p_origin, p_ref, p_user_name);
    END IF;
END; $$;

-- ── 4. record_production_run ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION record_production_run(
    item_code TEXT, quantity_to_produce REAL, ref_text TEXT, user_name TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE bom_data JSONB; bom_item JSONB; insumo_code TEXT; qty_needed REAL;
BEGIN
    PERFORM adjust_stock_quantity(item_code, quantity_to_produce, 'PRODUCAO_MANUAL', ref_text, user_name);
    SELECT COALESCE(bom_composition->'items', items) INTO bom_data FROM public.product_boms WHERE code = item_code;
    IF bom_data IS NOT NULL THEN
        FOR bom_item IN SELECT * FROM jsonb_array_elements(bom_data) LOOP
            insumo_code := COALESCE(bom_item->>'stockItemCode', bom_item->>'code');
            qty_needed  := (bom_item->>'qty_per_pack')::REAL * quantity_to_produce;
            IF insumo_code IS NOT NULL AND EXISTS (SELECT 1 FROM public.stock_items WHERE code = insumo_code) THEN
                PERFORM adjust_stock_quantity(insumo_code, -qty_needed, 'PRODUCAO_MANUAL', ref_text || ' (Consumo)', user_name);
            END IF;
        END LOOP;
    END IF;
END; $$;

-- ── 5. record_weighing_and_deduct_stock ──────────────────────────────────────
DROP FUNCTION IF EXISTS record_weighing_and_deduct_stock(TEXT, REAL, TEXT, TEXT, TEXT, TEXT, REAL, BOOLEAN, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS record_weighing_and_deduct_stock(TEXT, REAL, TEXT, TEXT, TEXT, TEXT, REAL, BOOLEAN, TEXT, TEXT, TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS record_weighing_and_deduct_stock(TEXT, NUMERIC, UUID, TEXT, TEXT, TEXT, NUMERIC, BOOLEAN, TEXT);

CREATE OR REPLACE FUNCTION record_weighing_and_deduct_stock(
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
    v_item_name TEXT; v_user_name TEXT; v_prod_item JSONB;
    v_insumo_code TEXT; v_qty_needed REAL;
BEGIN
    SELECT name INTO v_item_name FROM public.stock_items WHERE code = p_product_code;
    IF v_item_name IS NULL THEN SELECT name INTO v_item_name FROM public.product_boms WHERE code = p_product_code; END IF;
    SELECT name INTO v_user_name FROM public.users WHERE id::text = p_user_id;

    IF jsonb_array_length(p_produtos) = 0 THEN
        INSERT INTO public.weighing_batches (
            stock_item_code, stock_item_name, initial_qty, weighing_type, created_by_id, created_by_name,
            product_code, qty_produced, operador_maquina, operador_batedor, quantidade_batedor,
            com_cor, tipo_operacao, equipe_mistura, destino, base_sku, batch_name, produtos
        ) VALUES (
            p_product_code, COALESCE(v_item_name, p_product_code), p_qty_produced, 'daily', p_user_id, v_user_name,
            p_product_code, p_qty_produced, p_operador_maquina, p_operador_batedor, p_quantidade_batedor,
            p_com_cor, p_tipo_operacao, p_equipe_mistura, p_destino, p_base_sku, p_batch_name,
            jsonb_build_array(jsonb_build_object('sku', p_product_code, 'nome', COALESCE(v_item_name, p_product_code), 'qty_batida', p_quantidade_batedor, 'qty_ensacada', p_qty_produced))
        );
    ELSE
        INSERT INTO public.weighing_batches (
            stock_item_code, stock_item_name, initial_qty, weighing_type, created_by_id, created_by_name,
            product_code, qty_produced, operador_maquina, operador_batedor, quantidade_batedor,
            com_cor, tipo_operacao, equipe_mistura, destino, base_sku, batch_name, produtos
        ) VALUES (
            p_product_code, 'Lote Múltiplo', p_qty_produced, 'daily', p_user_id, v_user_name,
            p_product_code, p_qty_produced, p_operador_maquina, p_operador_batedor, p_quantidade_batedor,
            p_com_cor, p_tipo_operacao, p_equipe_mistura, p_destino, p_base_sku, p_batch_name, p_produtos
        );
    END IF;

    IF jsonb_array_length(p_produtos) = 0 THEN
        p_produtos := jsonb_build_array(jsonb_build_object('sku', p_product_code, 'qty_batida', p_quantidade_batedor, 'qty_ensacada', p_qty_produced));
    END IF;

    FOR v_prod_item IN SELECT * FROM jsonb_array_elements(p_produtos) LOOP
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
                UPDATE public.stock_items SET mixed_qty = COALESCE(mixed_qty, 0) + ((v_prod_item->>'qty_batida')::REAL - (v_prod_item->>'qty_ensacada')::REAL) WHERE code = v_insumo_code;
            END IF;
        END IF;
    END LOOP;

    IF p_com_cor AND p_base_sku IS NOT NULL AND p_base_sku != '' THEN
        PERFORM public.adjust_stock_quantity(p_base_sku, -p_qty_produced, 'ENSACAMENTO', 'Consumo Base (Cor)', v_user_name);
    END IF;
END; $$;

-- ── 6. record_grinding_run ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION record_grinding_run(
    source_code TEXT, source_qty REAL, output_code TEXT, output_name TEXT,
    output_qty REAL, op_mode TEXT, op_user_id TEXT, op_user_name TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_source_name TEXT;
BEGIN
    SELECT name INTO v_source_name FROM public.stock_items WHERE code = source_code;
    PERFORM adjust_stock_quantity(source_code, -source_qty, 'MOAGEM', 'Consumo Moagem', op_user_name);
    IF NOT EXISTS (SELECT 1 FROM public.stock_items WHERE code = output_code) THEN
        INSERT INTO public.stock_items (code, name, kind, unit, current_qty) VALUES (output_code, output_name, 'INSUMO', 'kg', 0);
    END IF;
    PERFORM adjust_stock_quantity(output_code, output_qty, 'MOAGEM', 'Produção Moagem', op_user_name);
    INSERT INTO public.grinding_batches (source_insumo_code, source_insumo_name, source_qty_used, output_insumo_code, output_insumo_name, output_qty_produced, mode, user_id, user_name)
    VALUES (source_code, COALESCE(v_source_name, source_code), source_qty, output_code, output_name, output_qty, op_mode, op_user_id, op_user_name);
END; $$;

-- ── 7. cancel_scan_id_and_revert_stock ───────────────────────────────────────
CREATE OR REPLACE FUNCTION cancel_scan_id_and_revert_stock(
    scan_id_to_cancel UUID, user_name TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_scan RECORD; v_order RECORD; v_master TEXT;
BEGIN
    SELECT * INTO v_scan FROM public.scan_logs WHERE id = scan_id_to_cancel;
    IF NOT FOUND THEN RETURN; END IF;
    SELECT * INTO v_order FROM public.orders
    WHERE (order_id = v_scan.display_key OR tracking = v_scan.display_key) AND status::text = 'BIPADO';
    IF v_order IS NOT NULL THEN
        UPDATE public.orders SET status = 'NORMAL' WHERE id = v_order.id;
        SELECT master_product_sku INTO v_master FROM public.sku_links WHERE imported_sku = v_order.sku;
        IF v_master IS NULL THEN v_master := v_order.sku; END IF;
        PERFORM adjust_stock_quantity(v_master, 1, 'AJUSTE_MANUAL', 'Cancelamento Bipagem ' || v_scan.display_key, user_name);
    END IF;
    DELETE FROM public.scan_logs WHERE id = scan_id_to_cancel;
END; $$;

-- ── 8. delete_orders ─────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.delete_orders(text[]);
DROP FUNCTION IF EXISTS public.delete_orders(uuid[]);
CREATE OR REPLACE FUNCTION delete_orders(order_ids TEXT[])
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN DELETE FROM public.orders WHERE id = ANY(order_ids); END; $$;

-- ── 9. clear_scan_history ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION clear_scan_history()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    DELETE FROM public.scan_logs;
    UPDATE public.orders SET status = 'NORMAL' WHERE status::text = 'BIPADO';
END; $$;

-- ── 10. bulk_set_initial_stock ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION bulk_set_initial_stock(updates JSONB, user_name TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_item JSONB; v_code TEXT; v_qty REAL; v_old REAL; v_delta REAL; v_count INT := 0;
BEGIN
    FOR v_item IN SELECT * FROM jsonb_array_elements(updates) LOOP
        v_code := v_item->>'item_code';
        v_qty  := (v_item->>'new_initial_quantity')::REAL;
        SELECT current_qty INTO v_old FROM public.stock_items WHERE code = v_code;
        IF NOT FOUND THEN
            SELECT current_qty INTO v_old FROM public.product_boms WHERE code = v_code;
            IF NOT FOUND THEN CONTINUE; END IF;
        END IF;
        v_delta := v_qty - v_old;
        IF v_delta = 0 THEN CONTINUE; END IF;
        PERFORM public.adjust_stock_quantity(v_code, v_delta, 'AJUSTE_MANUAL', 'Inventário em Massa', user_name);
        v_count := v_count + 1;
    END LOOP;
    RETURN 'Estoque atualizado: ' || v_count || ' itens';
END; $$;

-- ── 11. register_ready_stock ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION register_ready_stock(
    p_item_code TEXT, p_quantity REAL, p_ref TEXT, p_user_name TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_bom_data JSONB; v_bom_item JSONB; v_comp_sku TEXT; v_comp_qty REAL;
    v_is_volatile BOOLEAN; v_activated_volatile BOOLEAN := FALSE;
    v_item_stock REAL; v_has_enough BOOLEAN := TRUE;
BEGIN
    SELECT is_volatile_infinite INTO v_is_volatile FROM public.stock_items WHERE code = p_item_code;
    IF v_is_volatile IS NULL THEN
        SELECT is_volatile_infinite INTO v_is_volatile FROM public.product_boms WHERE code = p_item_code;
    END IF;

    SELECT COALESCE(bom_composition->'items', items) INTO v_bom_data FROM public.product_boms WHERE code = p_item_code;
    IF v_bom_data IS NOT NULL AND jsonb_array_length(v_bom_data) > 0 AND NOT COALESCE(v_is_volatile, FALSE) THEN
        FOR v_bom_item IN SELECT * FROM jsonb_array_elements(v_bom_data) LOOP
            v_comp_sku := COALESCE(v_bom_item->>'stockItemCode', v_bom_item->>'code');
            v_comp_qty := (v_bom_item->>'qty_per_pack')::REAL * p_quantity;
            SELECT current_qty INTO v_item_stock FROM public.stock_items WHERE code = v_comp_sku;
            IF v_item_stock IS NULL OR v_item_stock < v_comp_qty THEN v_has_enough := FALSE; END IF;
        END LOOP;
        IF NOT v_has_enough THEN
            UPDATE public.stock_items SET is_volatile_infinite = TRUE WHERE code = p_item_code;
            UPDATE public.product_boms SET is_volatile_infinite = TRUE WHERE code = p_item_code;
            v_is_volatile := TRUE;
            v_activated_volatile := TRUE;
        END IF;
    END IF;

    IF COALESCE(v_is_volatile, FALSE) THEN
        PERFORM public.adjust_stock_quantity(p_item_code, p_quantity, 'ESTOQUE_PRONTO', COALESCE(p_ref, 'Registro Volátil'), p_user_name);
    ELSE
        IF v_bom_data IS NOT NULL AND jsonb_array_length(v_bom_data) > 0 THEN
            FOR v_bom_item IN SELECT * FROM jsonb_array_elements(v_bom_data) LOOP
                v_comp_sku := COALESCE(v_bom_item->>'stockItemCode', v_bom_item->>'code');
                v_comp_qty := (v_bom_item->>'qty_per_pack')::REAL * p_quantity;
                PERFORM public.adjust_stock_quantity(v_comp_sku, -v_comp_qty, 'ESTOQUE_PRONTO', COALESCE(p_ref, 'Consumo Estoque Pronto'), p_user_name);
            END LOOP;
        END IF;
        PERFORM public.adjust_stock_quantity(p_item_code, p_quantity, 'ESTOQUE_PRONTO', COALESCE(p_ref, 'Registro Estoque Pronto'), p_user_name);
    END IF;

    RETURN jsonb_build_object('success', TRUE, 'was_volatile', COALESCE(v_is_volatile, FALSE), 'activated_volatile', v_activated_volatile);
END; $$;

-- ── 12. reset_volatile_status ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION reset_volatile_status(p_item_code TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE public.stock_items SET is_volatile_infinite = FALSE WHERE code = p_item_code;
    UPDATE public.product_boms SET is_volatile_infinite = FALSE WHERE code = p_item_code;
    RETURN jsonb_build_object('success', TRUE, 'message', 'Modo volátil desativado para ' || p_item_code);
END; $$;

-- ── 13. reset_database ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION reset_database()
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    DELETE FROM public.scan_logs;
    DELETE FROM public.orders;
    DELETE FROM public.stock_movements;
    DELETE FROM public.weighing_batches;
    DELETE FROM public.grinding_batches;
    DELETE FROM public.production_plan_items;
    DELETE FROM public.production_plans;
    DELETE FROM public.shopping_list_items;
    DELETE FROM public.returns;
    DELETE FROM public.import_history;
    DELETE FROM public.admin_notices;
    DELETE FROM public.etiquetas_historico;
    DELETE FROM public.zpl_batches;
    DELETE FROM public.sync_log;
    UPDATE public.stock_items SET current_qty = 0, mixed_qty = 0;
    UPDATE public.product_boms SET current_qty = 0, reserved_qty = 0, ready_qty = 0;
    RETURN 'Banco de dados limpo com sucesso.';
END; $$;

-- ═════════════════════════════════════════════════════════════════════════════
--  RPCs FISCAIS (NF-e)
-- ═════════════════════════════════════════════════════════════════════════════

-- ── 14. inserir_nfe ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION inserir_nfe(
    v_numero          TEXT,
    v_serie           TEXT,
    v_emissao         BIGINT,
    v_cliente         JSONB,
    v_valor           NUMERIC,
    v_pedidoid        TEXT     DEFAULT NULL,
    v_status          TEXT     DEFAULT 'RASCUNHO',
    v_chaveacesso     TEXT     DEFAULT NULL,
    v_xmloriginal     TEXT     DEFAULT NULL,
    v_xmlassinado     TEXT     DEFAULT NULL,
    v_sefazenvio      JSONB    DEFAULT NULL,
    v_certificadousado JSONB   DEFAULT NULL
) RETURNS SETOF nfes LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_now BIGINT;
BEGIN
    v_now := (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000);

    RETURN QUERY
    INSERT INTO public.nfes (
        numero, serie, emissao, cliente, valor,
        "pedidoId", status,
        "chaveAcesso", "xmlOriginal", "xmlAssinado",
        "sefazEnvio", "certificadoUsado",
        "criadoEm", "atualizadoEm"
    ) VALUES (
        v_numero, v_serie, v_emissao, COALESCE(v_cliente, '{}'), v_valor,
        v_pedidoid, v_status::nfe_status,
        v_chaveacesso, v_xmloriginal, v_xmlassinado,
        COALESCE(v_sefazenvio, '{}'), v_certificadousado,
        v_now, v_now
    )
    RETURNING *;
END; $$;

-- ── 15. listar_nfes ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION listar_nfes(
    v_status    TEXT DEFAULT NULL,
    v_pedidoid  TEXT DEFAULT NULL
) RETURNS SETOF nfes LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM public.nfes
    WHERE (v_status IS NULL OR status::text = v_status)
      AND (v_pedidoid IS NULL OR "pedidoId" = v_pedidoid)
    ORDER BY "criadoEm" DESC;
END; $$;

-- ── 16. obter_proximo_numero_nfe ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION obter_proximo_numero_nfe()
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_max INT;
BEGIN
    SELECT MAX(numero::INT) INTO v_max
    FROM public.nfes
    WHERE numero ~ '^\d+$';

    RETURN COALESCE(v_max, 0) + 1;
END; $$;

-- ═════════════════════════════════════════════════════════════════════════════
--  RPCs UTILITÁRIAS
-- ═════════════════════════════════════════════════════════════════════════════

-- ── 17. check_setup_status ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION check_setup_status()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE tables_status jsonb; types_status jsonb; functions_status jsonb; columns_status jsonb;
BEGIN
    EXECUTE 'SELECT jsonb_agg(jsonb_build_object(''name'', t, ''exists'', EXISTS (SELECT FROM pg_tables WHERE schemaname = ''public'' AND tablename = t))) FROM unnest($1::text[]) t'
        USING ARRAY[
            'stock_items','orders','stock_movements','users','scan_logs','product_boms',
            'sku_links','weighing_batches','production_plans','shopping_list_items',
            'stock_pack_groups','estoque_pronto','order_items','setores',
            'etiquetas_prioritarias','bling_nfe','bling_lotes_nfe','nfes','certificados',
            'objetos_postagem','audit_logs','sync_config','skus_vinculados',
            'sync_log','purchase_planning','zpl_batches','cost_calculations'
        ]
        INTO tables_status;

    EXECUTE 'SELECT jsonb_agg(jsonb_build_object(''name'', t, ''exists'', EXISTS (SELECT FROM pg_type WHERE typname = t))) FROM unnest($1::text[]) t'
        USING ARRAY['canal_type','order_status_value','nfe_status']
        INTO types_status;

    EXECUTE 'SELECT jsonb_agg(jsonb_build_object(''name'', t, ''exists'', EXISTS (SELECT FROM pg_proc WHERE proname = t))) FROM unnest($1::text[]) t'
        USING ARRAY[
            'sync_database','adjust_stock_quantity','record_production_run','login',
            'record_weighing_and_deduct_stock','record_grinding_run',
            'cancel_scan_id_and_revert_stock','register_ready_stock','reset_volatile_status',
            'deduct_bom_recursive','delete_orders','clear_scan_history',
            'bulk_set_initial_stock','reset_database','check_setup_status',
            'inserir_nfe','listar_nfes','obter_proximo_numero_nfe'
        ]
        INTO functions_status;

    SELECT jsonb_agg(jsonb_build_object('table', t, 'column', c, 'exists',
        EXISTS (SELECT FROM information_schema.columns WHERE table_name=t AND column_name=c)))
    INTO columns_status
    FROM (VALUES
        ('stock_items','barcode'),('stock_items','mixed_qty'),('stock_items','base_type'),
        ('stock_items','localizacao'),('stock_items','is_volatile_infinite'),('stock_items','bom_composition'),
        ('product_boms','product_type'),('product_boms','base_type'),('product_boms','color'),('product_boms','items'),
        ('orders','vinculado_bling'),('orders','venda_origem'),('orders','id_bling'),
        ('orders','descontar_volatil'),('orders','tracking_code'),('orders','plataforma_origem'),
        ('estoque_pronto','barcode'),('estoque_pronto','pallet'),
        ('weighing_batches','produtos'),('weighing_batches','tipo_operacao'),
        ('nfes','pedidoId'),('nfes','chaveAcesso'),('nfes','tentativasEnvio'),('nfes','erroDetalhes'),
        ('certificados','dataValidade'),('certificados','certificadoPem'),
        ('order_items','bling_item_id'),('order_items','item_id'),('order_items','canal'),
        ('users','permissions'),('grinding_batches','batch_name'),
        ('stock_movements','new_total'),('stock_movements','item_snapshot'),
        ('audit_logs','usuario_id'),('audit_logs','criado_em'),
        ('cost_calculations','platform_fee'),('stock_pack_groups','pack_size')
    ) AS v(t,c);

    RETURN jsonb_build_object(
        'tables_status',    tables_status,
        'types_status',     types_status,
        'functions_status', functions_status,
        'columns_status',   columns_status,
        'db_version',       '7.0'
    );
END; $$;

-- ── 18. sync_database (placeholder) ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION sync_database()
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN RETURN 'Banco de dados sincronizado com sucesso! (v7.0)'; END; $$;

-- ═════════════════════════════════════════════════════════════════════════════
--  VERIFICAÇÃO FINAL
-- ═════════════════════════════════════════════════════════════════════════════

SELECT table_name,
    (SELECT COUNT(*) FROM information_schema.columns c WHERE c.table_name = t.table_name AND c.table_schema = 'public') AS colunas
FROM information_schema.tables t
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- ════════════════════════════════════════════════════════════════════════════
-- FIM — ERP Fábrica Pro v7.0
-- 34 tabelas | 3 enums | 18 RPCs | 3 views | 60+ índices | triggers + RLS
--
-- NOVAS TABELAS v7: sync_log, purchase_planning, zpl_batches
-- COLUNAS NOVAS v7:
--   orders: descontar_volatil, tracking_code, plataforma_origem, data_expiracao, loja
--   users: permissions (JSONB)
--   stock_items: bom_composition, stock_initial_day, stock_final_day, day_date
--   stock_movements: new_total, operator_name, item_snapshot
--   grinding_batches: batch_name
--   stock_pack_groups: pack_size
--   cost_calculations: platform_fee
--   order_items: bling_item_id, item_id, canal, descricao, unidade, valor_unitario, subtotal, sincronizado_em
--   audit_logs: usuario_id, descricao, criado_em
-- LIMPEZA v7: nfes colunas snake_case duplicadas são removidas
-- ════════════════════════════════════════════════════════════════════════════
