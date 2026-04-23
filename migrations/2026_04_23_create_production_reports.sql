-- Migration: 2026-04-23
-- Objetivo: modelagem de dados para o novo menu "Produção Diária" (diário, semanal, mensal)
-- Cria tabelas, índices e views para armazenar relatórios diários de produção

BEGIN;

-- Garantir função de UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================
-- 1) Tabela: production_reports (registro diário)
-- =============================
CREATE TABLE IF NOT EXISTS production_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_date DATE NOT NULL,
    notes TEXT,
    employees_count INT DEFAULT 0,
    total_orders_imported INT DEFAULT 0,
    total_orders_collected INT DEFAULT 0,
    total_site_complements INT DEFAULT 0,
    indicators JSONB DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_production_reports_date ON production_reports (report_date);

-- =============================
-- 2) Tabela: production_report_processes (produção por processo)
-- Cada linha representa um agregado por processo (moagem, máquinas, ensacamento, mistura de cor)
-- =============================
CREATE TABLE IF NOT EXISTS production_report_processes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID NOT NULL REFERENCES production_reports(id) ON DELETE CASCADE,
    process_type TEXT NOT NULL, -- ex: 'MOAGEM','MAQUINA','ENSACAMENTO','MISTURA_COR'
    total_quantity REAL DEFAULT 0,
    details JSONB DEFAULT '[]'::jsonb, -- por exemplo {"batches":[...], "notes":"..."}
    grinding_batch_id UUID REFERENCES grinding_batches(id) ON DELETE SET NULL,
    weighing_batch_id UUID REFERENCES weighing_batches(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_prp_report_id ON production_report_processes (report_id);
CREATE INDEX IF NOT EXISTS idx_prp_type ON production_report_processes (process_type);

-- =============================
-- 3) Tabela: production_report_personnel (produção por pessoa)
-- Conecta funcionários com processo e quantidade produzida
-- =============================
CREATE TABLE IF NOT EXISTS production_report_personnel (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID NOT NULL REFERENCES production_reports(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    process_type TEXT,
    quantity_produced REAL DEFAULT 0,
    platform TEXT,
    notes TEXT,
    order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_prp_person_report ON production_report_personnel (report_id);
CREATE INDEX IF NOT EXISTS idx_prp_person_user ON production_report_personnel (user_id);

-- =============================
-- 4) Tabela: production_packages (pacotes feitos à parte)
-- =============================
CREATE TABLE IF NOT EXISTS production_packages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID NOT NULL REFERENCES production_reports(id) ON DELETE CASCADE,
    quantity INT DEFAULT 0,
    description TEXT,
    destination TEXT, -- ex: 'ESTOQUE_PRONTO','ESTOQUE_VOLATIL','OUTRO'
    product_sku TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pp_report_id ON production_packages (report_id);

-- =============================
-- 5) Tabela: production_stock_closures (controle de estoque no fechamento do dia)
-- Registra quantidades enviadas para estoque, abatimentos de volátil e snapshot do produto
-- =============================
CREATE TABLE IF NOT EXISTS production_stock_closures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID NOT NULL REFERENCES production_reports(id) ON DELETE CASCADE,
    stock_item_code TEXT REFERENCES stock_items(code) ON DELETE SET NULL,
    qty_sent_to_stock REAL DEFAULT 0,
    qty_deducted_from_volatile REAL DEFAULT 0,
    item_snapshot JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_psc_report_id ON production_stock_closures (report_id);
CREATE INDEX IF NOT EXISTS idx_psc_item_code ON production_stock_closures (stock_item_code);

-- =============================
-- 6) Tabela: production_collected_orders (pedidos coletados)
-- Sugestão automática e confirmação manual
-- =============================
CREATE TABLE IF NOT EXISTS production_collected_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID NOT NULL REFERENCES production_reports(id) ON DELETE CASCADE,
    suggested_quantity INT DEFAULT 0,
    confirmed_quantity INT DEFAULT 0,
    adjustment_reason TEXT,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pco_report_id ON production_collected_orders (report_id);

-- =============================
-- 7) Tabela: production_site_complements (pedidos complementares do site)
-- =============================
CREATE TABLE IF NOT EXISTS production_site_complements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID NOT NULL REFERENCES production_reports(id) ON DELETE CASCADE,
    quantity INT DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================
-- 8) Tabela: production_shifts e production_shift_assignments (jornada do dia)
-- Horários, períodos e alocação de funcionários por turno
-- =============================
CREATE TABLE IF NOT EXISTS production_shifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID NOT NULL REFERENCES production_reports(id) ON DELETE CASCADE,
    name TEXT,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_psh_report_id ON production_shifts (report_id);

CREATE TABLE IF NOT EXISTS production_shift_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shift_id UUID NOT NULL REFERENCES production_shifts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    period TEXT,
    notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_psa_shift_id ON production_shift_assignments (shift_id);

-- =============================
-- 9) Tabela: production_bipagens (bipagens vinculadas)
-- Vincula scan_logs com o relatório de produção para agregação por plataforma/pessoa/produto
-- =============================
CREATE TABLE IF NOT EXISTS production_bipagens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID NOT NULL REFERENCES production_reports(id) ON DELETE CASCADE,
    scan_log_id UUID REFERENCES scan_logs(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    platform TEXT,
    product_sku TEXT,
    quantity INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pb_report_id ON production_bipagens (report_id);
CREATE INDEX IF NOT EXISTS idx_pb_scan_log_id ON production_bipagens (scan_log_id);

-- =============================
-- 10) Views: resumos consolidados (diário / semanal / mensal)
-- As views são destinadas a consultas de leitura para dashboards e relatórios.
-- =============================
CREATE OR REPLACE VIEW production_summary_daily AS
SELECT
    pr.report_date::date AS report_date,
    SUM(pr.total_orders_imported) AS total_orders_imported,
    SUM(pr.total_orders_collected) AS total_orders_collected,
    SUM(pr.total_site_complements) AS total_site_complements,
    COALESCE(SUM(sub.total_processed_quantity),0) AS total_processed_quantity,
    COALESCE(SUM(sub.total_by_personnel),0) AS total_by_personnel
FROM production_reports pr
LEFT JOIN (
    SELECT report_id, SUM(total_quantity) AS total_processed_quantity, 0::numeric AS total_by_personnel
    FROM production_report_processes GROUP BY report_id
) sub ON sub.report_id = pr.id
LEFT JOIN (
    SELECT report_id, 0::numeric AS total_processed_quantity, SUM(quantity_produced) AS total_by_personnel
    FROM production_report_personnel GROUP BY report_id
) sub2 ON sub2.report_id = pr.id
GROUP BY pr.report_date
ORDER BY pr.report_date DESC;

CREATE OR REPLACE VIEW production_summary_weekly AS
SELECT date_trunc('week', pr.report_date::timestamptz)::date AS week_start,
       COUNT(*) AS reports_count,
       SUM(pr.total_orders_imported) AS total_orders_imported,
       SUM(pr.total_orders_collected) AS total_orders_collected,
       SUM(pr.total_site_complements) AS total_site_complements,
       COALESCE(SUM(sub.total_processed_quantity),0) AS total_processed_quantity,
       COALESCE(SUM(sub2.total_by_personnel),0) AS total_by_personnel
FROM production_reports pr
LEFT JOIN (
    SELECT report_id, SUM(total_quantity) AS total_processed_quantity FROM production_report_processes GROUP BY report_id
) sub ON sub.report_id = pr.id
LEFT JOIN (
    SELECT report_id, SUM(quantity_produced) AS total_by_personnel FROM production_report_personnel GROUP BY report_id
) sub2 ON sub2.report_id = pr.id
GROUP BY week_start
ORDER BY week_start DESC;

CREATE OR REPLACE VIEW production_summary_monthly AS
SELECT date_trunc('month', pr.report_date::timestamptz)::date AS month_start,
       COUNT(*) AS reports_count,
       SUM(pr.total_orders_imported) AS total_orders_imported,
       SUM(pr.total_orders_collected) AS total_orders_collected,
       SUM(pr.total_site_complements) AS total_site_complements,
       COALESCE(SUM(sub.total_processed_quantity),0) AS total_processed_quantity,
       COALESCE(SUM(sub2.total_by_personnel),0) AS total_by_personnel
FROM production_reports pr
LEFT JOIN (
    SELECT report_id, SUM(total_quantity) AS total_processed_quantity FROM production_report_processes GROUP BY report_id
) sub ON sub.report_id = pr.id
LEFT JOIN (
    SELECT report_id, SUM(quantity_produced) AS total_by_personnel FROM production_report_personnel GROUP BY report_id
) sub2 ON sub2.report_id = pr.id
GROUP BY month_start
ORDER BY month_start DESC;

COMMIT;

-- FIM da migration: cria estrutura básica para relatórios de produção.
