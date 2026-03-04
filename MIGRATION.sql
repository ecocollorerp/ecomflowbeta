/**
 * Migration SQL para Supabase
 * Executar no Dashboard do Supabase > SQL Editor
 * 
 * Cria tabelas para NFe e Certificados com RLS policies
 */

-- Tipos ENUM para status
DO $nfe_enum$
BEGIN
  CREATE TYPE nfe_status AS ENUM (
    'RASCUNHO',
    'ASSINADA',
    'ENVIADA',
    'AUTORIZADA',
    'CANCELADA',
    'REJEITADA',
    'ERRO'
  );
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'type nfe_status já existe, ignorando.';
END;
$nfe_enum$;

-- Tabela de NFes
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
  tentativasenvio INTEGER NOT NULL DEFAULT 0,
  errodetalhes JSONB DEFAULT NULL,
  criadoEm BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000,
  atualizadoEm BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000,
  UNIQUE(numero, serie)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_nfes_status ON nfes(status);
CREATE INDEX IF NOT EXISTS idx_nfes_pedidoId ON nfes(pedidoId);
CREATE INDEX IF NOT EXISTS idx_nfes_chaveAcesso ON nfes(chaveAcesso);
CREATE INDEX IF NOT EXISTS idx_nfes_criadoEm ON nfes(criadoEm DESC);

-- Tabela de Certificados
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

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_certificados_cnpj ON certificados(cnpj);
CREATE INDEX IF NOT EXISTS idx_certificados_thumbprint ON certificados(thumbprint);
CREATE INDEX IF NOT EXISTS idx_certificados_valido ON certificados(valido);
CREATE INDEX IF NOT EXISTS idx_certificados_dataValidade ON certificados(dataValidade DESC);

-- Row Level Security (RLS)
ALTER TABLE nfes ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificados ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso (permitir leitura/escrita de API)
DROP POLICY IF EXISTS "Permitir leitura nfes" ON nfes;
CREATE POLICY "Permitir leitura nfes" ON nfes
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir inserir nfes" ON nfes;
CREATE POLICY "Permitir inserir nfes" ON nfes
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir atualizar nfes" ON nfes;
CREATE POLICY "Permitir atualizar nfes" ON nfes
  FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir deletar nfes" ON nfes;
CREATE POLICY "Permitir deletar nfes" ON nfes
  FOR DELETE USING (true);

DROP POLICY IF EXISTS "Permitir leitura certificados" ON certificados;
CREATE POLICY "Permitir leitura certificados" ON certificados
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir inserir certificados" ON certificados;
CREATE POLICY "Permitir inserir certificados" ON certificados
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir atualizar certificados" ON certificados;
CREATE POLICY "Permitir atualizar certificados" ON certificados
  FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir deletar certificados" ON certificados;
CREATE POLICY "Permitir deletar certificados" ON certificados
  FOR DELETE USING (true);

-- Função para atualizar atualizadoEm automaticamente
CREATE OR REPLACE FUNCTION atualizar_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $fn_ts$
BEGIN
  NEW.atualizadoEm = EXTRACT(EPOCH FROM NOW())::BIGINT * 1000;
  RETURN NEW;
END;
$fn_ts$;

-- Trigger para NFes
DROP TRIGGER IF EXISTS atualizar_nfes_timestamp ON nfes;
CREATE TRIGGER atualizar_nfes_timestamp
BEFORE UPDATE ON nfes
FOR EACH ROW
EXECUTE FUNCTION atualizar_timestamp();

-- Trigger para Certificados
DROP TRIGGER IF EXISTS atualizar_certificados_timestamp ON certificados;
CREATE TRIGGER atualizar_certificados_timestamp
BEFORE UPDATE ON certificados
FOR EACH ROW
EXECUTE FUNCTION atualizar_timestamp();

-- ═══════════════════════════════════════════════════════════════════════════
-- RPC Function: inserir_nfe
-- Usada pelo nfeSupabase.ts como alternativa ao INSERT direto via REST.
-- Contorna o RLS e garante que a NFe é criada com todos os campos corretos.
-- ═══════════════════════════════════════════════════════════════════════════

-- Remove TODAS as versões anteriores de inserir_nfe (qualquer assinatura)
DO $drop_inserir_nfe$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT oid::regprocedure::text AS sig
    FROM pg_catalog.pg_proc
    WHERE proname = 'inserir_nfe'
      AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE';
  END LOOP;
END;
$drop_inserir_nfe$;

CREATE OR REPLACE FUNCTION inserir_nfe(
  v_numero           TEXT,
  v_serie            TEXT,
  v_emissao          BIGINT,
  v_cliente          JSONB,
  v_valor            DECIMAL,
  v_pedidoid         TEXT        DEFAULT NULL,
  v_status           TEXT        DEFAULT 'RASCUNHO',
  v_chaveacesso      TEXT        DEFAULT NULL,
  v_xmloriginal      TEXT        DEFAULT NULL,
  v_xmlassinado      TEXT        DEFAULT NULL,
  v_sefazenvio       JSONB       DEFAULT NULL,
  v_certificadousado JSONB       DEFAULT NULL
)
RETURNS SETOF nfes
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_nfe$
DECLARE
  v_id TEXT;
BEGIN
  v_id := 'nfe-' || extract(epoch from now())::bigint || '-' || substr(md5(random()::text), 1, 9);

  RETURN QUERY
  INSERT INTO nfes (
    id, numero, serie, emissao, cliente, valor,
    pedidoid, status, chaveacesso, xmloriginal, xmlassinado,
    sefazenvio, certificadousado, tentativasenvio, errodetalhes,
    criadoem, atualizadoem
  ) VALUES (
    v_id, v_numero, v_serie, v_emissao, v_cliente, v_valor,
    v_pedidoid, v_status::nfe_status, v_chaveacesso, v_xmloriginal, v_xmlassinado,
    v_sefazenvio, v_certificadousado, 0, NULL,
    extract(epoch from now())::bigint * 1000,
    extract(epoch from now())::bigint * 1000
  )
  RETURNING *;
END;
$fn_nfe$;

-- Permissão para o role anon/authenticated usar a função RPC
GRANT EXECUTE ON FUNCTION inserir_nfe(
  TEXT, TEXT, BIGINT, JSONB, DECIMAL,
  TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB
) TO anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION INCREMENTAL
-- Execute estas instruções se a tabela nfes já existir e estiver faltando
-- as colunas tentativasenvio e errodetalhes.
-- ═══════════════════════════════════════════════════════════════════════════
DO $nfe_cols$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nfes' AND column_name = 'tentativasenvio'
  ) THEN
    ALTER TABLE nfes ADD COLUMN tentativasenvio INTEGER NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nfes' AND column_name = 'errodetalhes'
  ) THEN
    ALTER TABLE nfes ADD COLUMN errodetalhes JSONB DEFAULT NULL;
  END IF;
END;
$nfe_cols$;
