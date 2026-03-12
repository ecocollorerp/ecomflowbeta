-- ============================================================================
-- migrations/etiquetas_prioritarias.sql
-- Criação da tabela e índices para Etiquetas Prioritárias
-- Fluxo: Pedidos com NF-e → Etiquetas Bling → Armazenagem ZPL/PC
-- ============================================================================

-- Criar tabela etiquetas_prioritarias
CREATE TABLE IF NOT EXISTS public.etiquetas_prioritarias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id TEXT NOT NULL,
  numero_bling TEXT NOT NULL,
  nfe_lote TEXT NOT NULL,
  data_geracao TIMESTAMPTZ DEFAULT now(),
  
  -- Status do processamento
  status_processamento TEXT NOT NULL DEFAULT 'pendente' 
    CHECK (status_processamento IN ('pendente', 'processando', 'concluido', 'salvo_no_pc', 'erro')),
  
  -- Tipo de armazenagem
  armazenagem TEXT NOT NULL DEFAULT 'zpl'
    CHECK (armazenagem IN ('zpl', 'pc')),
  
  -- Conteúdo
  conteudo_zpl TEXT,
  conteudo_txt TEXT,
  caminho_arquivo TEXT,
  
  -- Rastreabilidade completa
  rastreabilidade JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Estrutura esperada:
  -- {
  --   "numeroBling": "string",
  --   "lojaVirtual": "string",
  --   "canalVendas": "string" (MERCADO_LIVRE, SHOPEE, SITE, etc)
  -- }
  
  -- Metadados adicionais
  metadados JSONB DEFAULT '{}'::jsonb,
  -- Estrutura esperada:
  -- {
  --   "codeRastreamento": "string",
  --   "destinatario": "string",
  --   "remetente": "string",
  --   "transportadora": "string"
  -- }
  
  -- Auditoria
  criado_por TEXT,
  atualizado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_por TEXT,
  
  CONSTRAINT etiquetas_prioritarias_num_nfe_uq UNIQUE (numero_bling, nfe_lote)
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_etiquetas_nfe_lote 
  ON public.etiquetas_prioritarias(nfe_lote);

CREATE INDEX IF NOT EXISTS idx_etiquetas_numero_bling 
  ON public.etiquetas_prioritarias(numero_bling);

CREATE INDEX IF NOT EXISTS idx_etiquetas_pedido_id 
  ON public.etiquetas_prioritarias(pedido_id);

CREATE INDEX IF NOT EXISTS idx_etiquetas_status 
  ON public.etiquetas_prioritarias(status_processamento);

CREATE INDEX IF NOT EXISTS idx_etiquetas_armazenagem 
  ON public.etiquetas_prioritarias(armazenagem);

CREATE INDEX IF NOT EXISTS idx_etiquetas_data_geracao 
  ON public.etiquetas_prioritarias(data_geracao DESC);

CREATE INDEX IF NOT EXISTS idx_etiquetas_rastreabilidade_canal 
  ON public.etiquetas_prioritarias 
  USING gin (rastreabilidade jsonb_path_ops);

-- Criar trigger para atualizar timestamp
CREATE OR REPLACE FUNCTION atualizar_timestamp_etiquetas()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_atualizar_timestamp_etiquetas 
  ON public.etiquetas_prioritarias;

CREATE TRIGGER trigger_atualizar_timestamp_etiquetas
BEFORE UPDATE ON public.etiquetas_prioritarias
FOR EACH ROW
EXECUTE FUNCTION atualizar_timestamp_etiquetas();

-- ============================================================================
-- Políticas de Segurança (RLS)
-- ============================================================================

-- Habilitar RLS
ALTER TABLE public.etiquetas_prioritarias ENABLE ROW LEVEL SECURITY;

-- Policy: Qualquer usuário autenticado pode ver etiquetas
DROP POLICY IF EXISTS "etiquetas_select_any" ON public.etiquetas_prioritarias;
CREATE POLICY "etiquetas_select_any" ON public.etiquetas_prioritarias
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Policy: Usuários autenticados podem criar etiquetas
DROP POLICY IF EXISTS "etiquetas_insert_auth" ON public.etiquetas_prioritarias;
CREATE POLICY "etiquetas_insert_auth" ON public.etiquetas_prioritarias
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Policy: Usuários autenticados podem atualizar etiquetas próprias
DROP POLICY IF EXISTS "etiquetas_update_auth" ON public.etiquetas_prioritarias;
CREATE POLICY "etiquetas_update_auth" ON public.etiquetas_prioritarias
  FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Policy: Usuários autenticados podem deletar etiquetas
DROP POLICY IF EXISTS "etiquetas_delete_auth" ON public.etiquetas_prioritarias;
CREATE POLICY "etiquetas_delete_auth" ON public.etiquetas_prioritarias
  FOR DELETE
  USING (auth.role() = 'authenticated');

-- ============================================================================
-- Views úteis
-- ============================================================================

-- View: Etiquetas por Lote
CREATE OR REPLACE VIEW etiquetas_por_lote AS
SELECT 
  nfe_lote AS lote,
  COUNT(*) AS total_etiquetas,
  COUNT(*) FILTER (WHERE status_processamento = 'concluido') AS processadas,
  COUNT(*) FILTER (WHERE armazenagem = 'zpl') AS armazenadas_zpl,
  COUNT(*) FILTER (WHERE armazenagem = 'pc') AS salvas_pc,
  MAX(data_geracao) AS ultima_geracao
FROM public.etiquetas_prioritarias
GROUP BY nfe_lote
ORDER BY ultima_geracao DESC;

-- View: Etiquetas por Canal
CREATE OR REPLACE VIEW etiquetas_por_canal AS
SELECT 
  rastreabilidade->>'canalVendas' AS canal,
  COUNT(*) AS total_etiquetas,
  COUNT(*) FILTER (WHERE status_processamento = 'concluido') AS processadas,
  COUNT(DISTINCT numero_bling) AS pedidos_diferentes
FROM public.etiquetas_prioritarias
GROUP BY rastreabilidade->>'canalVendas'
ORDER BY total_etiquetas DESC;

-- View: Etiquetas por Loja Virtual
CREATE OR REPLACE VIEW etiquetas_por_loja AS
SELECT 
  rastreabilidade->>'lojaVirtual' AS loja,
  COUNT(*) AS total_etiquetas,
  COUNT(*) FILTER (WHERE status_processamento = 'concluido') AS processadas,
  COUNT(DISTINCT nfe_lote) AS lotes_diferentes
FROM public.etiquetas_prioritarias
GROUP BY rastreabilidade->>'lojaVirtual'
ORDER BY total_etiquetas DESC;

-- View: Resumo de Rastreabilidade
CREATE OR REPLACE VIEW resumo_rastreabilidade AS
SELECT 
  numero_bling,
  nfe_lote,
  rastreabilidade->>'lojaVirtual' AS loja_virtual,
  rastreabilidade->>'canalVendas' AS canal_vendas,
  status_processamento,
  armazenagem,
  data_geracao,
  metadados->>'codeRastreamento' AS cod_rastreamento,
  metadados->>'transportadora' AS transportadora
FROM public.etiquetas_prioritarias
ORDER BY data_geracao DESC;

-- ============================================================================
-- Comentários de documentação
-- ============================================================================

COMMENT ON TABLE public.etiquetas_prioritarias IS 
  'Armazena etiquetas de envio geradas a partir do fluxo de pedidos de vendas com NF-e emitida. Integração com Bling API.';

COMMENT ON COLUMN public.etiquetas_prioritarias.numero_bling IS 
  'Número do pedido conforme registrado no Bling';

COMMENT ON COLUMN public.etiquetas_prioritarias.nfe_lote IS 
  'Identificador do lote da NF-e para agrupamento de etiquetas';

COMMENT ON COLUMN public.etiquetas_prioritarias.status_processamento IS 
  'Estado do processamento: pendente, processando, concluido ou salvo_no_pc';

COMMENT ON COLUMN public.etiquetas_prioritarias.armazenagem IS 
  'Local de armazenagem: zpl (banco de dados) ou pc (arquivo local)';

COMMENT ON COLUMN public.etiquetas_prioritarias.rastreabilidade IS 
  'JSONB contendo número Bling, loja virtual e canal de vendas para rastreabilidade completa';

COMMENT ON COLUMN public.etiquetas_prioritarias.metadados IS 
  'JSONB com informações adicionais como código de rastreamento, transportadora, etc.';
