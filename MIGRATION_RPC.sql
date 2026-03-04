/**
 * SUPABASE RPC FUNCTION - Workaround para PostgREST Schema Cache Bug
 * 
 * Este arquivo contém uma função RPC que contorna o bug de cache de schema 
 * do PostgREST ao fazer inserts nas tabelas nfes e certificados.
 * 
 * Execute no SQL Editor do Supabase Dashboard
 */

-- ============================================================================
-- CRIAR FUNÇÃO RPC PARA INSERIR NFe (Contorna schema cache bug)
-- ============================================================================
DROP FUNCTION IF EXISTS inserir_nfe(TEXT, TEXT, BIGINT, JSONB, DECIMAL, TEXT, nfe_status, TEXT, TEXT, TEXT, JSONB, JSONB);

CREATE OR REPLACE FUNCTION inserir_nfe(
  v_numero TEXT,
  v_serie TEXT,
  v_emissao BIGINT,
  v_cliente JSONB,
  v_valor DECIMAL,
  v_pedidoid TEXT DEFAULT NULL,
  v_status nfe_status DEFAULT 'RASCUNHO',
  v_chaveacesso TEXT DEFAULT NULL,
  v_xmloriginal TEXT DEFAULT NULL,
  v_xmlassinado TEXT DEFAULT NULL,
  v_sefazenvio JSONB DEFAULT NULL,
  v_certificadousado JSONB DEFAULT NULL
)
RETURNS TABLE (
  id TEXT,
  numero TEXT,
  serie TEXT,
  emissao BIGINT,
  cliente JSONB,
  valor DECIMAL,
  pedidoid TEXT,
  status nfe_status,
  chaveacesso TEXT,
  xmloriginal TEXT,
  xmlassinado TEXT,
  sefazenvio JSONB,
  certificadousado JSONB,
  tentativasenvio INTEGER,
  errodetalhes TEXT,
  criadoem BIGINT
) AS $$
BEGIN
  RETURN QUERY
  INSERT INTO nfes (
    numero, serie, emissao, cliente, valor, pedidoid, status,
    chaveacesso, xmloriginal, xmlassinado, sefazenvio, certificadousado
  ) VALUES (
    v_numero, v_serie, v_emissao, v_cliente, v_valor, v_pedidoid, v_status,
    v_chaveacesso, v_xmloriginal, v_xmlassinado, v_sefazenvio, v_certificadousado
  )
  RETURNING nfes.id, nfes.numero, nfes.serie, nfes.emissao, nfes.cliente,
            nfes.valor, nfes.pedidoid, nfes.status, nfes.chaveacesso,
            nfes.xmloriginal, nfes.xmlassinado, nfes.sefazenvio,
            nfes.certificadousado, nfes.tentativasenvio, nfes.errodetalhes, nfes.criadoem;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- GRANT execute permission to anon role
-- ============================================================================
GRANT EXECUTE ON FUNCTION inserir_nfe(
  TEXT, TEXT, BIGINT, JSONB, DECIMAL, TEXT, nfe_status, 
  TEXT, TEXT, TEXT, JSONB, JSONB
) TO anon, authenticated;

-- ============================================================================
-- CRIAR FUNÇÃO RPC PARA LISTAR NFes (com filtros)
-- ============================================================================
DROP FUNCTION IF EXISTS listar_nfes(nfe_status, TEXT);

CREATE OR REPLACE FUNCTION listar_nfes(
  v_status nfe_status DEFAULT NULL,
  v_pedidoid TEXT DEFAULT NULL
)
RETURNS TABLE (
  id TEXT,
  numero TEXT,
  serie TEXT,
  emissao BIGINT,
  cliente JSONB,
  valor DECIMAL,
  pedidoid TEXT,
  status nfe_status,
  chaveacesso TEXT,
  xmloriginal TEXT,
  xmlassinado TEXT,
  sefazenvio JSONB,
  certificadousado JSONB,
  tentativasenvio INTEGER,
  errodetalhes TEXT,
  criadoem BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM nfes
  WHERE (v_status IS NULL OR nfes.status = v_status)
    AND (v_pedidoid IS NULL OR nfes.pedidoid = v_pedidoid)
  ORDER BY nfes.criadoem DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION listar_nfes(nfe_status, TEXT) TO anon, authenticated;

-- ============================================================================
-- CRIAR FUNÇÃO RPC PARA OBTER PRÓXIMO NÚMERO
-- ============================================================================
DROP FUNCTION IF EXISTS obter_proximo_numero_nfe();

CREATE OR REPLACE FUNCTION obter_proximo_numero_nfe()
RETURNS INTEGER AS $$
DECLARE
  v_max_numero INTEGER;
BEGIN
  SELECT COALESCE(MAX(numero::INTEGER), 0) + 1
  INTO v_max_numero
  FROM nfes
  WHERE numero ~ '^\d+$';
  
  RETURN v_max_numero;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION obter_proximo_numero_nfe() TO anon, authenticated;

-- ============================================================================
-- PRONTO!
-- ============================================================================
-- Funções RPC criadas:
--   ✓ inserir_nfe (contorna schema cache bug)
--   ✓ listar_nfes (com filtros por status/pedidoId)
--   ✓ obter_proximo_numero_nfe (retorna próximo número)
