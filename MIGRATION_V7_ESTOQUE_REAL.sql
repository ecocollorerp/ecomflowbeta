-- ============================================================
-- MIGRATION_V7_ESTOQUE_REAL.sql
-- Adiciona persistência para Grupos de Expedição (Volátil) 
-- e Estoque Dependente
-- ============================================================

-- Tabela para gerenciar instâncias de pacotes (mock no Supabase client)
CREATE TABLE IF NOT EXISTS estoque_pronto (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    created_by TEXT -- nome do usuário (operador)
);
    
-- Índice na tabela estoque_pronto para busca rápida
CREATE INDEX IF NOT EXISTS idx_estoque_pronto_status ON estoque_pronto(status);
CREATE INDEX IF NOT EXISTS idx_estoque_pronto_sku ON estoque_pronto(stock_item_id);

-- Nova Tabela Order Items caso pedidos reais tenham subdivisões 
CREATE TABLE IF NOT EXISTS order_items (
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

CREATE INDEX IF NOT EXISTS idx_order_items_o_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_sku ON order_items(sku);
