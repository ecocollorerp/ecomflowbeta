-- Migration: Tabela para armazenar Objetos de Postagem (sincronizados do Bling)
-- Permite exclusão local sem afetar dados no Bling

CREATE TABLE IF NOT EXISTS objetos_postagem (
  id BIGSERIAL PRIMARY KEY,
  bling_id TEXT,                          -- ID do objeto no Bling
  nfe_id BIGINT,                          -- ID da NF-e vinculada
  nfe_numero TEXT,                        -- Número da NF-e
  numero_pedido_loja TEXT,                -- Número do pedido na loja/marketplace
  destinatario TEXT,                      -- Nome do destinatário
  rastreio TEXT,                          -- Código de rastreamento
  servico TEXT,                           -- Nome do serviço (Shopee Express, PAC, etc.)
  transportadora TEXT,                    -- Nome da transportadora
  situacao TEXT DEFAULT 'Pendente',       -- Situação do objeto
  valor_nota DECIMAL(18,2) DEFAULT 0,    -- Valor da nota
  data_criacao TEXT,                      -- Data de criação no Bling
  prazo_entrega TEXT,                     -- Prazo de entrega previsto
  dimensoes JSONB DEFAULT '{}',          -- Dimensões (peso, altura, largura, comprimento)
  dados_bling JSONB DEFAULT '{}',        -- Dados brutos do Bling (para referência)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(bling_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_objetos_postagem_nfe_id ON objetos_postagem(nfe_id);
CREATE INDEX IF NOT EXISTS idx_objetos_postagem_rastreio ON objetos_postagem(rastreio);
CREATE INDEX IF NOT EXISTS idx_objetos_postagem_numero_pedido ON objetos_postagem(numero_pedido_loja);
CREATE INDEX IF NOT EXISTS idx_objetos_postagem_created ON objetos_postagem(created_at DESC);

-- RLS (Row Level Security) - desabilitado por padrão para uso anon
ALTER TABLE objetos_postagem ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON objetos_postagem FOR ALL TO anon USING (true) WITH CHECK (true);
