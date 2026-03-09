-- ============================================================================
-- MIGRATION: Criar tabela de auditoria para registros de operações
-- Versão: 5.4 (2026-03-09)
--
-- INSTRUÇÕES:
--   1. Supabase → SQL Editor → New Query
--   2. Cole TUDO → Run
--   3. NÃO APAGA DADOS - apenas cria nova tabela
--
-- ✅ SEGURO PARA BANCO COM DADOS
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- PASSO 1: Criar tabela de auditoria
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
    id                UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    timestamp         TIMESTAMPTZ  DEFAULT NOW(),
    usuario           TEXT         NOT NULL DEFAULT 'sistema',
    acao              TEXT         NOT NULL,
    modulo            TEXT         NOT NULL, -- 'nfe', 'importacao', 'bling', 'estoque', 'etiquetas', 'danfe'
    tipo              TEXT         NOT NULL, -- 'criacao', 'atualizacao', 'deletacao', 'sincronizacao', 'geracao', 'exportacao'
    resultado         TEXT         NOT NULL, -- 'sucesso', 'erro', 'aviso'
    dados             JSONB        DEFAULT '{}'::jsonb,
    erro              JSONB,       -- { "mensagem": "...", "stack": "..." }
    duracao_ms        INT,
    created_at        TIMESTAMPTZ  DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- PASSO 2: Criar índices para performance
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_modulo ON audit_logs (modulo);
CREATE INDEX IF NOT EXISTS idx_audit_usuario ON audit_logs (usuario);
CREATE INDEX IF NOT EXISTS idx_audit_resultado ON audit_logs (resultado);
CREATE INDEX IF NOT EXISTS idx_audit_tipo ON audit_logs (tipo);

-- Índice composto para busca por data + módulo
CREATE INDEX IF NOT EXISTS idx_audit_data_modulo ON audit_logs (timestamp DESC, modulo);

-- ─────────────────────────────────────────────────────────────────────────────
-- PASSO 3: Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all" ON audit_logs;
CREATE POLICY "allow_all" ON audit_logs FOR ALL USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- PASSO 4: Função para limpar logs antigos automaticamente
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION limpar_audit_logs_antigos()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    data_limite TIMESTAMPTZ;
    total_removidos INT;
BEGIN
    -- Manter apenas últimos 30 dias
    data_limite := NOW() - INTERVAL '30 days';
    
    DELETE FROM audit_logs WHERE timestamp < data_limite;
    GET DIAGNOSTICS total_removidos = ROW_COUNT;
    
    RAISE NOTICE 'Limpeza de auditoria: % registros removidos', total_removidos;
END;
$$;

-- Agendar limpeza diária (descomente para ativar em produção)
-- SELECT cron.schedule('limpar-audit-logs-antigos', '0 2 * * *', 'SELECT limpar_audit_logs_antigos()');

-- ─────────────────────────────────────────────────────────────────────────────
-- PASSO 5: Registrar migração
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO app_settings (key, value)
VALUES ('migration_audit_logs', jsonb_build_object(
    'version', '5.4',
    'date', NOW()::text,
    'description', 'Created audit_logs table for operation tracking',
    'status', 'completed'
))
ON CONFLICT (key) DO UPDATE
SET value = jsonb_build_object(
    'version', '5.4',
    'date', NOW()::text,
    'description', 'Created audit_logs table for operation tracking',
    'status', 'completed'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- PASSO 6: Verificação
-- ─────────────────────────────────────────────────────────────────────────────
SELECT 
    tablename,
    (SELECT COUNT(*) FROM information_schema.columns 
     WHERE table_name='audit_logs') AS total_colunas
FROM pg_tables 
WHERE tablename='audit_logs' 
AND schemaname='public';

SELECT 'MIGRAÇÃO CONCLUÍDA! Tabela audit_logs criada com sucesso.' AS resultado;

-- ============================================================================
-- FIM — MIGRATION v5.4 (2026-03-09)
-- ============================================================================
