-- ============================================================================
-- SUPABASE MIGRATION - COMPLETO E FUNCIONANDO
-- Execute no SQL Editor do Supabase Dashboard
-- ============================================================================

-- LIMPEZA
DROP TABLE IF EXISTS stock_movements CASCADE;
DROP TABLE IF EXISTS stock_items CASCADE;
DROP TABLE IF EXISTS estoque_pronto CASCADE;
DROP TABLE IF EXISTS stock_reservations CASCADE;
DROP TABLE IF EXISTS nfes CASCADE;
DROP TABLE IF EXISTS certificados CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS sku_links CASCADE;
DROP TABLE IF EXISTS products_combined CASCADE;
DROP TABLE IF EXISTS pack_groups CASCADE;

DROP TYPE IF EXISTS nfe_status CASCADE;
DROP TYPE IF EXISTS stock_kind CASCADE;
DROP TYPE IF EXISTS movement_origin CASCADE;
DROP TYPE IF EXISTS order_status CASCADE;
DROP TYPE IF EXISTS stock_movement_type CASCADE;

-- ============================================================================
-- TIPOS ENUM
-- ============================================================================
CREATE TYPE stock_kind AS ENUM ('INSUMO', 'PRODUTO', 'PROCESSADO');
CREATE TYPE movement_origin AS ENUM ('AJUSTE_MANUAL', 'PRODUCAO_MANUAL', 'BIP', 'PESAGEM', 'MOAGEM', 'IMPORT_XML', 'PRODUCAO_INTERNA', 'BLING_SINCRONIZADO');
CREATE TYPE nfe_status AS ENUM ('RASCUNHO', 'ASSINADA', 'ENVIADA', 'AUTORIZADA', 'CANCELADA', 'REJEITADA', 'ERRO');
CREATE TYPE order_status AS ENUM ('RASCUNHO', 'CONFIRMADO', 'SEPARANDO', 'SEPARADO', 'EMBALANDO', 'EMBALADO', 'ENVIADO', 'ENTREGUE', 'CANCELADO');
CREATE TYPE stock_movement_type AS ENUM ('ENTRADA', 'SAÍDA', 'BALANÇO', 'AJUSTE');

-- ============================================================================
-- TABELAS
-- ============================================================================

-- Produtos/Insumos em Estoque
CREATE TABLE stock_items (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    kind stock_kind DEFAULT 'PRODUTO',
    
    -- Quantidades
    current_qty NUMERIC(12,2) DEFAULT 0,
    reserved_qty NUMERIC(12,2) DEFAULT 0,
    ready_qty NUMERIC(12,2) DEFAULT 0,
    
    -- Estoque Pronto
    is_ready BOOLEAN DEFAULT FALSE,
    ready_location TEXT,
    ready_date BIGINT,
    
    -- Preços
    cost_price NUMERIC(12,4),
    sell_price NUMERIC(12,4),
    
    -- Bling
    bling_id TEXT,
    bling_sku TEXT,
    
    -- Metadados
    unit TEXT DEFAULT 'UN',
    category TEXT,
    status TEXT DEFAULT 'ATIVO',
    
    created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000,
    updated_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000
);

-- Estoque Pronto Detalhado
CREATE TABLE estoque_pronto (
    id TEXT PRIMARY KEY,
    stock_item_id TEXT NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
    batch_id TEXT NOT NULL,
    lote_numero TEXT,
    
    -- Quantidades
    quantidade_total NUMERIC(12,2) NOT NULL,
    quantidade_disponivel NUMERIC(12,2) NOT NULL,
    quantidade_reservada NUMERIC(12,2) DEFAULT 0,
    
    -- Localização e Estado
    localizacao TEXT,
    ambiente TEXT DEFAULT 'ARMAZEM',
    status TEXT DEFAULT 'PRONTO' CHECK (status IN ('PRONTO', 'RESERVADO', 'EXPEDIDO', 'DEVOLVIDO')),
    
    -- Datas
    data_preparacao BIGINT,
    data_disponibilidade BIGINT,
    data_expedicao BIGINT,
    
    -- Rastreamento
    operador_id TEXT,
    movimento_origem movement_origin,
    observacoes TEXT,
    
    created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000,
    updated_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000
);

-- Movimentações de Estoque (Auditoria)
CREATE TABLE stock_movements (
    id TEXT PRIMARY KEY,
    stock_item_id TEXT NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
    
    -- Detalhes
    quantity NUMERIC(12,2) NOT NULL,
    movement_type stock_movement_type NOT NULL,
    origin movement_origin NOT NULL,
    
    -- Rastreamento
    order_id TEXT,
    reference_id TEXT,
    operator_id TEXT,
    
    -- Observações
    description TEXT,
    observations TEXT,
    
    created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000
);

-- Reservas de Estoque
CREATE TABLE stock_reservations (
    id TEXT PRIMARY KEY,
    stock_item_id TEXT NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
    order_id TEXT NOT NULL,
    quantity NUMERIC(12,2) NOT NULL,
    status TEXT DEFAULT 'ATIVA' CHECK (status IN ('ATIVA', 'CONVERTIDA', 'CANCELADA')),
    
    reserved_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000,
    expired_at BIGINT,
    converted_at BIGINT,
    
    created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000
);

-- Pedidos
CREATE TABLE orders (
    id TEXT PRIMARY KEY,
    bling_id TEXT UNIQUE,
    order_number TEXT NOT NULL,
    
    -- Cliente
    customer_name TEXT NOT NULL,
    customer_email TEXT,
    customer_phone TEXT,
    customer_cpf_cnpj TEXT,
    
    -- Valores
    subtotal NUMERIC(12,2),
    frete NUMERIC(12,2) DEFAULT 0,
    desconto NUMERIC(12,2) DEFAULT 0,
    total NUMERIC(12,2),
    
    -- Status
    status order_status DEFAULT 'RASCUNHO',
    
    -- Datas
    order_date BIGINT,
    deadline_date BIGINT,
    shipped_date BIGINT,
    delivery_date BIGINT,
    
    -- Rastreamento
    tracking_code TEXT,
    carrier TEXT,
    
    -- Metadados
    sales_channel TEXT,
    observations TEXT,
    
    created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000,
    updated_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000
);

-- Itens dos Pedidos
CREATE TABLE order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    stock_item_id TEXT REFERENCES stock_items(id),
    
    -- SKU e Produto
    sku TEXT NOT NULL,
    product_name TEXT NOT NULL,
    
    -- Quantidades
    quantity NUMERIC(12,2) NOT NULL,
    completed_quantity NUMERIC(12,2) DEFAULT 0,
    
    -- Preços
    unit_price NUMERIC(12,4) NOT NULL,
    subtotal NUMERIC(12,2),
    
    created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000
);

-- Links SKU
CREATE TABLE sku_links (
    id TEXT PRIMARY KEY,
    imported_sku TEXT NOT NULL UNIQUE,
    master_product_sku TEXT NOT NULL,
    created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000,
    updated_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000
);

-- Produtos Combinados
CREATE TABLE products_combined (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    products JSONB NOT NULL,
    created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000,
    updated_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000
);

-- Grupos de Empacotamento
CREATE TABLE pack_groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    packs JSONB NOT NULL,
    created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000,
    updated_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000
);

-- Notas Fiscais Eletrônicas
CREATE TABLE nfes (
    id TEXT PRIMARY KEY,
    numero TEXT NOT NULL,
    serie TEXT NOT NULL,
    emissao BIGINT NOT NULL,
    
    -- Relacionamentos
    cliente JSONB,
    valor DECIMAL(18,2),
    pedido_id TEXT REFERENCES orders(id),
    
    -- Status
    status nfe_status DEFAULT 'RASCUNHO',
    
    -- Dados NFe
    chave_acesso TEXT UNIQUE,
    xml_original TEXT,
    xml_assinado TEXT,
    
    -- SEFAZ
    sefaz_envio JSONB,
    certificado_usado JSONB,
    tentativas_envio INT DEFAULT 0,
    erro_detalhes TEXT,
    
    created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000,
    updated_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000
);

-- Certificados Digitais
CREATE TABLE certificados (
    id TEXT PRIMARY KEY,
    nome TEXT,
    cnpj TEXT NOT NULL,
    tipo TEXT DEFAULT 'A1' CHECK (tipo IN ('A1', 'A3', 'e-CNPJ')),
    
    -- Dados
    issuer TEXT,
    subject TEXT,
    valido BOOLEAN DEFAULT true,
    data_inicio BIGINT,
    data_validade BIGINT,
    thumbprint TEXT,
    algoritmo_assinatura TEXT,
    
    -- Chaves criptografadas
    certificado_pem TEXT,
    chave_pem TEXT,
    
    -- Erros
    erros JSONB,
    
    created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000,
    updated_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000
);

-- ============================================================================
-- ÍNDICES (Performance)
-- ============================================================================
CREATE INDEX idx_stock_items_code ON stock_items(code);
CREATE INDEX idx_stock_items_bling_id ON stock_items(bling_id);
CREATE INDEX idx_stock_items_kind ON stock_items(kind);
CREATE INDEX idx_stock_items_status ON stock_items(status);

CREATE INDEX idx_estoque_pronto_status ON estoque_pronto(status);
CREATE INDEX idx_estoque_pronto_batch_id ON estoque_pronto(batch_id);
CREATE INDEX idx_estoque_pronto_stock_item_id ON estoque_pronto(stock_item_id);
CREATE INDEX idx_estoque_pronto_data_disponibilidade ON estoque_pronto(data_disponibilidade);

CREATE INDEX idx_stock_movements_stock_item_id ON stock_movements(stock_item_id);
CREATE INDEX idx_stock_movements_order_id ON stock_movements(order_id);
CREATE INDEX idx_stock_movements_created_at ON stock_movements(created_at);

CREATE INDEX idx_stock_reservations_status ON stock_reservations(status);
CREATE INDEX idx_stock_reservations_order_id ON stock_reservations(order_id);

CREATE INDEX idx_orders_bling_id ON orders(bling_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_sku ON order_items(sku);

CREATE INDEX idx_nfes_status ON nfes(status);
CREATE INDEX idx_nfes_created_at ON nfes(created_at);

CREATE INDEX idx_certificados_cnpj ON certificados(cnpj);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE stock_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE estoque_pronto ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE nfes ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_stock_items" ON stock_items FOR ALL USING (true);
CREATE POLICY "allow_all_estoque_pronto" ON estoque_pronto FOR ALL USING (true);
CREATE POLICY "allow_all_stock_movements" ON stock_movements FOR ALL USING (true);
CREATE POLICY "allow_all_stock_reservations" ON stock_reservations FOR ALL USING (true);
CREATE POLICY "allow_all_orders" ON orders FOR ALL USING (true);
CREATE POLICY "allow_all_order_items" ON order_items FOR ALL USING (true);
CREATE POLICY "allow_all_nfes" ON nfes FOR ALL USING (true);
CREATE POLICY "allow_all_certificados" ON certificados FOR ALL USING (true);

-- ============================================================================
-- FUNÇÕES
-- ============================================================================

-- Atualizar estoque quando movimento é registrado
CREATE OR REPLACE FUNCTION update_stock_on_movement()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.movement_type = 'ENTRADA' THEN
        UPDATE stock_items SET current_qty = current_qty + NEW.quantity WHERE id = NEW.stock_item_id;
    ELSIF NEW.movement_type = 'SAÍDA' THEN
        UPDATE stock_items SET current_qty = greatest(0, current_qty - NEW.quantity) WHERE id = NEW.stock_item_id;
    ELSIF NEW.movement_type = 'BALANÇO' THEN
        UPDATE stock_items SET current_qty = NEW.quantity WHERE id = NEW.stock_item_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_stock_on_movement
AFTER INSERT ON stock_movements
FOR EACH ROW
EXECUTE FUNCTION update_stock_on_movement();

-- Calcular estoque pronto disponível
CREATE OR REPLACE FUNCTION get_estoque_pronto_disponivel(p_stock_item_id TEXT)
RETURNS NUMERIC AS $$
BEGIN
    RETURN COALESCE(
        (SELECT SUM(quantidade_disponivel) 
         FROM estoque_pronto 
         WHERE stock_item_id = p_stock_item_id AND status = 'PRONTO'),
        0
    );
END;
$$ LANGUAGE plpgsql;

-- Verificar se há estoque suficiente
CREATE OR REPLACE FUNCTION check_stock_availability(p_stock_item_id TEXT, p_quantidade NUMERIC)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM stock_items 
        WHERE id = p_stock_item_id AND (current_qty - reserved_qty) >= p_quantidade
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ✅ BANCO DE DADOS PRONTO PARA USAR
-- ============================================================================
