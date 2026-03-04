-- ============================================================================
-- SUPABASE MIGRATION - NFe System (VERSÃO FINAL - 100% COMPLETA)
-- Execute no SQL Editor do Supabase Dashboard
-- ============================================================================

DROP TABLE IF EXISTS nfes CASCADE;
DROP TABLE IF EXISTS certificados CASCADE;
DROP TYPE IF EXISTS nfe_status CASCADE;

-- ============================================================================
-- ENUM
-- ============================================================================
CREATE TYPE nfe_status AS ENUM ('RASCUNHO', 'ASSINADA', 'ENVIADA', 'AUTORIZADA', 'CANCELADA', 'REJEITADA', 'ERRO');

-- ============================================================================
-- TABELA NFES
-- ============================================================================
CREATE TABLE nfes (
  id TEXT PRIMARY KEY,
  numero TEXT NOT NULL,
  serie TEXT NOT NULL,
  emissao BIGINT NOT NULL,
  cliente JSONB,
  valor DECIMAL(18,2),
  pedidoId TEXT,
  status nfe_status DEFAULT 'RASCUNHO',
  chaveAcesso TEXT,
  xmlOriginal TEXT,
  xmlAssinado TEXT,
  sefazEnvio JSONB,
  certificadoUsado JSONB,
  tentativasEnvio INT DEFAULT 0,
  erroDetalhes TEXT,
  criadoEm BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000
);

-- ============================================================================
-- TABELA CERTIFICADOS
-- ============================================================================
CREATE TABLE certificados (
  id TEXT PRIMARY KEY,
  nome TEXT,
  cnpj TEXT NOT NULL,
  tipo TEXT DEFAULT 'A1',
  issuer TEXT,
  subject TEXT,
  valido BOOLEAN DEFAULT true,
  dataInicio BIGINT,
  dataValidade BIGINT,
  thumbprint TEXT,
  algoritmoAssinatura TEXT,
  certificadoPem TEXT,
  chavePem TEXT,
  erros JSONB,
  criadoEm BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000
);

-- ============================================================================
-- ÍNDICES
-- ============================================================================
CREATE INDEX idx_nfes_status ON nfes(status);
CREATE INDEX idx_nfes_pedidoId ON nfes(pedidoId);
CREATE INDEX idx_certificados_cnpj ON certificados(cnpj);

-- ============================================================================
-- RLS
-- ============================================================================
ALTER TABLE nfes ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_nfes" ON nfes FOR ALL USING (true);
CREATE POLICY "allow_all_certs" ON certificados FOR ALL USING (true);

-- ============================================================================
-- PRONTO! Tabelas criadas com sucesso
-- ============================================================================
