/**
 * SUPABASE MIGRATION - NFe System
 * Execute isso no SQL Editor do Supabase Dashboard
 * 
 * Passo 1: Abra https://app.supabase.com
 * Passo 2: Projeto: uafsmsiwaxopxznupuqw
 * Passo 3: SQL Editor > New Query
 * Passo 4: Cole todo este código abaixo
 * Passo 5: Clique RUN
 */

-- ============================================================================
-- 1. LIMPAR ESTRUTURAS ANTIGAS (se houver)
-- ============================================================================
DROP TABLE IF EXISTS nfes CASCADE;
DROP TABLE IF EXISTS certificados CASCADE;
DROP TYPE IF EXISTS nfe_status CASCADE;

-- ============================================================================
-- 2. CRIAR ENUM PARA STATUS
-- ============================================================================
CREATE TYPE nfe_status AS ENUM (
  'RASCUNHO',
  'ASSINADA',
  'ENVIADA',
  'AUTORIZADA',
  'CANCELADA',
  'REJEITADA',
  'ERRO'
);

-- ============================================================================
-- 3. CRIAR TABELA NFES
-- ============================================================================
CREATE TABLE IF NOT EXISTS nfes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL,
  serie TEXT NOT NULL,
  emissao BIGINT NOT NULL,
  cliente JSONB NOT NULL DEFAULT '{}',
  valor DECIMAL(18,2) NOT NULL,
  pedidoId TEXT,
  status nfe_status DEFAULT 'RASCUNHO',
  chaveAcesso TEXT UNIQUE,
  xmlOriginal TEXT,
  xmlAssinado TEXT,
  sefazEnvio JSONB DEFAULT '{}',
  certificadoUsado JSONB,
  criadoEm BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000,
  atualizadoEm BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000,
  UNIQUE(numero, serie)
);

-- ============================================================================
-- 4. CRIAR ÍNDICES NA TABELA NFES
-- ============================================================================
CREATE INDEX idx_nfes_status ON nfes(status);
CREATE INDEX idx_nfes_pedidoId ON nfes(pedidoId);
CREATE INDEX idx_nfes_chaveAcesso ON nfes(chaveAcesso);
CREATE INDEX idx_nfes_criadoEm ON nfes(criadoEm DESC);

-- ============================================================================
-- 5. CRIAR TABELA CERTIFICADOS
-- ============================================================================
CREATE TABLE IF NOT EXISTS certificados (
  id TEXT PRIMARY KEY,
  nome TEXT,
  cnpj TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'A1',
  issuer TEXT,
  subject TEXT,
  valido BOOLEAN DEFAULT true,
  dataInicio BIGINT,
  dataValidade BIGINT NOT NULL,
  thumbprint TEXT UNIQUE NOT NULL,
  algoritmoAssinatura TEXT,
  certificadoPem TEXT NOT NULL,
  chavePem TEXT NOT NULL,
  erros JSONB DEFAULT '[]'::jsonb,
  criadoEm BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000,
  atualizadoEm BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000
);

-- ============================================================================
-- 6. CRIAR ÍNDICES NA TABELA CERTIFICADOS
-- ============================================================================
CREATE INDEX idx_certificados_cnpj ON certificados(cnpj);
CREATE INDEX idx_certificados_thumbprint ON certificados(thumbprint);
CREATE INDEX idx_certificados_valido ON certificados(valido);
CREATE INDEX idx_certificados_dataValidade ON certificados(dataValidade DESC);

-- ============================================================================
-- 7. ATIVAR ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE nfes ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificados ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 8. CRIAR POLÍTICAS DE ACESSO
-- ============================================================================
CREATE POLICY "nfes_select" ON nfes FOR SELECT USING (true);
CREATE POLICY "nfes_insert" ON nfes FOR INSERT WITH CHECK (true);
CREATE POLICY "nfes_update" ON nfes FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "nfes_delete" ON nfes FOR DELETE USING (true);

CREATE POLICY "certificados_select" ON certificados FOR SELECT USING (true);
CREATE POLICY "certificados_insert" ON certificados FOR INSERT WITH CHECK (true);
CREATE POLICY "certificados_update" ON certificados FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "certificados_delete" ON certificados FOR DELETE USING (true);

-- ============================================================================
-- 9. CRIAR FUNÇÃO E TRIGGERS PARA ATUALIZAR TIMESTAMP
-- ============================================================================
CREATE OR REPLACE FUNCTION atualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizadoEm = EXTRACT(EPOCH FROM NOW())::BIGINT * 1000;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER atualizar_nfes_timestamp
BEFORE UPDATE ON nfes
FOR EACH ROW
EXECUTE FUNCTION atualizar_timestamp();

CREATE TRIGGER atualizar_certificados_timestamp
BEFORE UPDATE ON certificados
FOR EACH ROW
EXECUTE FUNCTION atualizar_timestamp();

-- ============================================================================
-- PRONTO!
-- ============================================================================
-- Tabelas criadas:
--   ✓ nfes (com 15 colunas)
--   ✓ certificados (com 15 colunas)
--   ✓ nfe_status (ENUM)
--   ✓ Índices (4 em cada tabela)
--   ✓ RLS policies (8 no total)
--   ✓ Triggers automáticos
