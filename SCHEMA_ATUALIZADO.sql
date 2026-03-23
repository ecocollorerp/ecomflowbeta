-- ============================================================================
-- ERP Fábrica Pro - Schema Atualizado (v5.3)
-- Gerado automaticamente a partir de lib/sql.ts
-- ============================================================================

-- ========== EXTENSÕES ==========
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========== ENUMS ==========
CREATE TYPE public.canal_type AS ENUM ('ML', 'SHOPEE', 'SITE', 'ALL');
CREATE TYPE public.order_status_value AS ENUM ('NORMAL', 'ERRO', 'DEVOLVIDO', 'BIPADO', 'SOLUCIONADO');

-- ========== TABELAS ==========

-- 1. app_settings (Configurações gerais do sistema)
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. users (Usuários e funcionários)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT,
    password TEXT,
    role TEXT NOT NULL,            -- 'ADMIN', 'OPERATOR', 'VIEWER'
    setor TEXT[] DEFAULT '{}',
    prefix TEXT,
    attendance JSONB DEFAULT '[]'::jsonb,
    ui_settings JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. stock_items (Itens de estoque - insumos, processados, produtos)
CREATE TABLE IF NOT EXISTS public.stock_items (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,             -- 'INSUMO', 'PROCESSADO', 'PRODUTO'
    unit TEXT NOT NULL,             -- 'kg', 'un', 'l', 'ml', etc.
    current_qty REAL NOT NULL DEFAULT 0,
    min_qty REAL NOT NULL DEFAULT 0,
    category TEXT DEFAULT '',
    color TEXT,
    product_type TEXT,              -- 'papel_de_parede', 'miudos'
    base_type TEXT,                 -- 'branca', 'preta', 'especial'
    expedition_items JSONB DEFAULT '[]'::jsonb,
    substitute_product_code TEXT,
    barcode TEXT,
    localizacao TEXT,
    mixed_qty REAL DEFAULT 0,       -- Saldo de mistura (ensacamento)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. stock_movements (Movimentações de estoque)
CREATE TABLE IF NOT EXISTS public.stock_movements (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    stock_item_code TEXT NOT NULL,
    stock_item_name TEXT NOT NULL,
    origin TEXT NOT NULL,           -- 'AJUSTE_MANUAL', 'PRODUCAO_MANUAL', 'ENSACAMENTO', 'MOAGEM', 'BIPAGEM'
    qty_delta REAL NOT NULL,
    ref TEXT,
    product_sku TEXT,
    created_by_name TEXT,
    from_weighing BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. product_boms (Receitas / Bill of Materials)
CREATE TABLE IF NOT EXISTS public.product_boms (
    code TEXT PRIMARY KEY,
    name TEXT,
    description TEXT,
    kind TEXT DEFAULT 'PRODUTO',
    current_qty REAL DEFAULT 0,
    reserved_qty REAL DEFAULT 0,
    ready_qty REAL DEFAULT 0,
    is_ready BOOLEAN DEFAULT FALSE,
    ready_location TEXT,
    ready_date TIMESTAMPTZ,
    ready_batch_id TEXT,
    cost_price REAL DEFAULT 0,
    sell_price REAL DEFAULT 0,
    bling_id TEXT,
    bling_sku TEXT,
    unit TEXT DEFAULT 'un',
    category TEXT,
    status TEXT DEFAULT 'ATIVO',
    bom_composition JSONB DEFAULT '{"items": []}'::jsonb,
    items JSONB DEFAULT '[]'::jsonb,  -- retrocompatibilidade
    min_qty REAL DEFAULT 0,
    is_volatile_infinite BOOLEAN DEFAULT FALSE,
    product_type TEXT,              -- 'papel_de_parede', 'miudos'
    base_type TEXT,                 -- 'branca', 'preta', 'especial'
    color TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. orders (Pedidos importados das planilhas)
CREATE TABLE IF NOT EXISTS public.orders (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    bling_numero TEXT,
    tracking TEXT,
    sku TEXT NOT NULL,
    qty_original INT NOT NULL,
    multiplicador INT DEFAULT 1,
    qty_final INT NOT NULL,
    color TEXT,
    canal public.canal_type,
    data TEXT,                      -- Data da venda (YYYY-MM-DD ou DD/MM/YYYY)
    data_prevista_envio TEXT,
    status public.order_status_value DEFAULT 'NORMAL',
    customer_name TEXT,
    customer_cpf_cnpj TEXT,
    price_gross REAL DEFAULT 0,
    price_total REAL DEFAULT 0,
    platform_fees REAL DEFAULT 0,
    shipping_fee REAL DEFAULT 0,
    shipping_paid_by_customer REAL DEFAULT 0,
    price_net REAL DEFAULT 0,
    error_reason TEXT,
    resolution_details JSONB,
    vinculado_bling BOOLEAN DEFAULT FALSE,
    etiqueta_gerada BOOLEAN DEFAULT FALSE,
    lote_id TEXT,
    id_pedido_loja TEXT,
    venda_origem TEXT,
    id_bling TEXT,
    situacao_id INT,
    situacao_valor TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS orders_order_id_sku_idx ON public.orders (order_id, sku);

-- 7. scan_logs (Logs de bipagem)
CREATE TABLE IF NOT EXISTS public.scan_logs (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    scanned_at TIMESTAMPTZ DEFAULT NOW(),
    user_id TEXT,
    user_name TEXT,
    device TEXT,
    display_key TEXT,
    status TEXT,                    -- 'OK', 'NOT_FOUND', 'ALREADY_SCANNED', etc.
    synced BOOLEAN DEFAULT FALSE,
    canal TEXT
);

-- 8. sku_links (Vínculos de SKU importado → SKU mestre)
CREATE TABLE IF NOT EXISTS public.sku_links (
    imported_sku TEXT PRIMARY KEY,
    master_product_sku TEXT NOT NULL
);

-- 9. weighing_batches (Pesagem / Ensacamento)
CREATE TABLE IF NOT EXISTS public.weighing_batches (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    stock_item_code TEXT NOT NULL,
    stock_item_name TEXT NOT NULL,
    initial_qty REAL NOT NULL,
    used_qty REAL DEFAULT 0,
    weighing_type TEXT DEFAULT 'daily',
    created_by_id TEXT,
    created_by_name TEXT,
    product_code TEXT,
    qty_produced REAL,
    operador_maquina TEXT,
    operador_batedor TEXT,
    quantidade_batedor NUMERIC,
    com_cor BOOLEAN DEFAULT FALSE,
    tipo_operacao TEXT DEFAULT 'ENSACAMENTO',  -- 'ENSACAMENTO', 'SO_BATEU', 'SO_ENSACADEIRA'
    equipe_mistura TEXT,
    destino TEXT,
    base_sku TEXT,
    batch_name TEXT,
    produtos JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. grinding_batches (Moagem)
CREATE TABLE IF NOT EXISTS public.grinding_batches (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    source_insumo_code TEXT NOT NULL,
    source_insumo_name TEXT,
    source_qty_used REAL NOT NULL,
    output_insumo_code TEXT NOT NULL,
    output_insumo_name TEXT,
    output_qty_produced REAL NOT NULL,
    mode TEXT,
    user_id TEXT,
    user_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. production_plans (Planejamento de produção)
CREATE TABLE IF NOT EXISTS public.production_plans (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    name TEXT NOT NULL,
    status TEXT DEFAULT 'Draft',
    parameters JSONB,
    plan_date TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. production_plan_items (Itens do plano de produção)
CREATE TABLE IF NOT EXISTS public.production_plan_items (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    plan_id UUID REFERENCES public.production_plans(id) ON DELETE CASCADE,
    product_sku TEXT,
    product_name TEXT,
    current_stock REAL,
    avg_daily_consumption REAL,
    forecasted_demand REAL,
    required_production REAL
);

-- 13. shopping_list_items (Lista de compras)
CREATE TABLE IF NOT EXISTS public.shopping_list_items (
    stock_item_code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit TEXT NOT NULL,
    is_purchased BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. import_history (Histórico de importações)
CREATE TABLE IF NOT EXISTS public.import_history (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    file_name TEXT,
    processed_at TIMESTAMPTZ,
    user_name TEXT,
    item_count INT,
    unlinked_count INT,
    canal TEXT,
    processed_data JSONB
);

-- 15. etiquetas_historico (Histórico de etiquetas geradas)
CREATE TABLE IF NOT EXISTS public.etiquetas_historico (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by_name TEXT,
    page_count INT,
    zpl_content TEXT,
    settings_snapshot JSONB,
    page_hashes TEXT[] DEFAULT '{}'
);

-- 16. returns (Devoluções)
CREATE TABLE IF NOT EXISTS public.returns (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    tracking TEXT NOT NULL,
    customer_name TEXT,
    logged_by_id TEXT,
    logged_by_name TEXT,
    order_id TEXT,
    logged_at TIMESTAMPTZ DEFAULT NOW()
);

-- 17. admin_notices (Avisos administrativos)
CREATE TABLE IF NOT EXISTS public.admin_notices (
    id TEXT PRIMARY KEY,
    text TEXT NOT NULL,
    level TEXT NOT NULL,           -- 'info', 'warning', 'success'
    type TEXT NOT NULL,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 18. stock_pack_groups (Grupos de pacotes de estoque)
CREATE TABLE IF NOT EXISTS public.stock_pack_groups (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    name TEXT NOT NULL,
    barcode TEXT,
    item_codes TEXT[] NOT NULL,
    final_product_code TEXT,
    min_pack_qty REAL NOT NULL DEFAULT 0,
    tipo TEXT DEFAULT 'tradicional',      -- 'tradicional', 'volatil'
    quantidade_volatil NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 19. estoque_pronto (Estoque pronto / Pacotes prontos)
CREATE TABLE IF NOT EXISTS public.estoque_pronto (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    batch_id TEXT NOT NULL,
    stock_item_id TEXT NOT NULL,
    quantidade_total NUMERIC DEFAULT 0,
    quantidade_disponivel NUMERIC DEFAULT 0,
    localizacao TEXT,
    status TEXT DEFAULT 'PRONTO',
    observacoes TEXT,
    produtos JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT,
    barcode TEXT,
    pallet TEXT,
    galpao TEXT,
    com_desempenadeira BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_estoque_pronto_barcode ON public.estoque_pronto(barcode);
CREATE INDEX IF NOT EXISTS idx_estoque_pronto_status ON public.estoque_pronto(status);
CREATE INDEX IF NOT EXISTS idx_estoque_pronto_sku ON public.estoque_pronto(stock_item_id);

-- 20. order_items (Itens de pedidos - detalhamento Bling)
CREATE TABLE IF NOT EXISTS public.order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    bling_id TEXT,
    sku TEXT NOT NULL,
    nome TEXT,
    quantidade NUMERIC DEFAULT 1,
    preco_unitario NUMERIC DEFAULT 0,
    preco_total NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'nao_sincronizado',
    data_criacao TIMESTAMPTZ DEFAULT NOW(),
    ultima_sincronizacao TIMESTAMPTZ,
    erro_mensagem TEXT
);
CREATE INDEX IF NOT EXISTS idx_order_items_o_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_sku ON public.order_items(sku);

-- 21. setores (Setores da fábrica)
CREATE TABLE IF NOT EXISTS public.setores (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 22. etiquetas_prioritarias (Etiquetas prioritárias NF-e/Bling)
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
CREATE INDEX IF NOT EXISTS idx_etiquetas_nfe_lote ON public.etiquetas_prioritarias(nfe_lote);
CREATE INDEX IF NOT EXISTS idx_etiquetas_numero_bling ON public.etiquetas_prioritarias(numero_bling);
CREATE INDEX IF NOT EXISTS idx_etiquetas_pedido_id ON public.etiquetas_prioritarias(pedido_id);
CREATE INDEX IF NOT EXISTS idx_etiquetas_status ON public.etiquetas_prioritarias(status_processamento);

-- 23. bling_nfe (Cache local de NF-e do Bling)
CREATE TABLE IF NOT EXISTS public.bling_nfe (
    id TEXT PRIMARY KEY,
    bling_id TEXT NOT NULL,
    numero TEXT,
    serie TEXT,
    situacao INT,
    situacao_descricao TEXT,
    data_emissao TIMESTAMPTZ,
    valor_total NUMERIC DEFAULT 0,
    chave_acesso TEXT,
    link_danfe TEXT,
    cliente_nome TEXT,
    cliente_doc TEXT,
    id_venda TEXT,
    id_loja_virtual TEXT,
    canal_nome TEXT,
    tipo INT DEFAULT 1,
    last_sync TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bling_nfe_bling_id ON public.bling_nfe(bling_id);
CREATE INDEX IF NOT EXISTS idx_bling_nfe_id_venda ON public.bling_nfe(id_venda);
CREATE INDEX IF NOT EXISTS idx_bling_nfe_chave ON public.bling_nfe(chave_acesso);

-- ========== VIEW ==========
CREATE OR REPLACE VIEW public.vw_dados_analiticos AS
SELECT 
    o.id AS id_pedido,
    o.order_id AS codigo_pedido,
    o.data AS data_pedido,
    o.canal,
    o.status AS status_pedido,
    o.sku AS sku_mestre,
    si.name AS nome_produto,
    o.qty_final AS quantidade_final,
    sl.user_name AS bipado_por,
    sl.user_id AS bipado_por_id,
    sl.scanned_at AS data_bipagem,
    o.venda_origem AS canal_real,
    o.id_pedido_loja AS num_loja_virtual,
    CASE 
        WHEN o.status = 'BIPADO' AND sl.scanned_at IS NOT NULL AND TO_DATE(o.data, 'YYYY-MM-DD') < DATE(sl.scanned_at) THEN 'Bipado com Atraso'
        WHEN o.status = 'BIPADO' THEN 'Bipado no Prazo'
        WHEN o.status = 'NORMAL' AND TO_DATE(o.data, 'YYYY-MM-DD') < CURRENT_DATE THEN 'Atrasado'
        WHEN o.status = 'NORMAL' THEN 'Pendente'
        ELSE o.status::text
    END AS status_derivado,
    EXTRACT(EPOCH FROM (sl.scanned_at - (o.data::date + interval '12 hours'))) / 3600 AS tempo_separacao_horas
FROM public.orders o
LEFT JOIN public.stock_items si ON o.sku = si.code
LEFT JOIN public.scan_logs sl ON (sl.display_key = o.order_id OR sl.display_key = o.tracking) AND sl.status = 'OK';

-- ========== FUNÇÕES RPC ==========

-- 1. adjust_stock_quantity (Ajuste simples de estoque)
-- 2. record_production_run (Produção com baixa de BOM)
-- 3. login (Autenticação)
-- 4. reset_database (Reset total)
-- 5. clear_scan_history (Limpa bipagens)
-- 6. bulk_set_initial_stock (Inventário em massa)
-- 7. cancel_scan_id_and_revert_stock (Cancelar bipagem)
-- 8. delete_orders (Deletar pedidos)
-- 9. deduct_bom_recursive (Dedução recursiva de BOM)
-- 10. record_weighing_and_deduct_stock (Pesagem/Ensacamento completo)
-- 11. record_grinding_run (Moagem)
-- 12. check_setup_status (Verificar status do banco)

-- ========== RESUMO ==========
-- Total de Tabelas: 23
-- Total de RPCs: 12
-- Total de Views: 1
-- Total de Enums: 2
-- Total de Índices: 10+
