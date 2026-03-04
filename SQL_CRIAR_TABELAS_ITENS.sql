-- ============================================================================
-- SQL - Criar Tabelas para Itens de Pedidos (Supabase)
-- ============================================================================

-- Tabela: order_items (Itens dos Pedidos)
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Chaves
  order_id VARCHAR(50) NOT NULL,
  bling_id VARCHAR(100),
  bling_item_id VARCHAR(100),
  
  -- Dados do Item
  sku VARCHAR(50) NOT NULL,
  descricao TEXT NOT NULL,
  unidade VARCHAR(10) DEFAULT 'UN',
  quantidade DECIMAL(10,3) NOT NULL,
  valor_unitario DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  
  -- Sincronização
  sincronizado_em TIMESTAMP,
  status VARCHAR(20) DEFAULT 'novo', -- novo, sincronizado, erro, devolvido
  
  -- Rastreamento
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW(),
  deletado_em TIMESTAMP
);

-- Índices para performance
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_bling_id ON order_items(bling_id);
CREATE INDEX idx_order_items_sku ON order_items(sku);
CREATE INDEX idx_order_items_status ON order_items(status);
CREATE INDEX idx_order_items_sincronizado ON order_items(sincronizado_em);

-- Tabela de sincronização (log)
CREATE TABLE IF NOT EXISTS sync_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Dados da sincronização
  tipo VARCHAR(20) NOT NULL, -- 'order_items', 'orders', 'products'
  bling_id VARCHAR(100),
  order_id VARCHAR(50),
  
  -- Status
  sucesso BOOLEAN DEFAULT FALSE,
  mensagem TEXT,
  
  -- Timestamps
  executado_em TIMESTAMP DEFAULT NOW(),
  proxima_tentativa TIMESTAMP
);

CREATE INDEX idx_sync_log_tipo ON sync_log(tipo);
CREATE INDEX idx_sync_log_proxima ON sync_log(proxima_tentativa);

-- Tabela de configuração de sincronização
CREATE TABLE IF NOT EXISTS sync_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Configuração
  chave VARCHAR(100) UNIQUE NOT NULL,
  valor TEXT NOT NULL,
  
  -- Timestamps
  atualizado_em TIMESTAMP DEFAULT NOW()
);

-- Inserts padrão
INSERT INTO sync_config (chave, valor) VALUES 
  ('ultimo_sync_pedidos', NOW()::TEXT),
  ('ultimo_sync_itens', NOW()::TEXT),
  ('sincronizar_automatico', 'true'),
  ('intervalo_sync_minutos', '5')
ON CONFLICT (chave) DO UPDATE SET atualizado_em = NOW();
