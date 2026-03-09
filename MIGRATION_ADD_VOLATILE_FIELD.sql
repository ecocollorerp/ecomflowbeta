-- ============================================================================
-- MIGRATION: Adicionar Campo Estoque Volátil Infinito
-- Versão: 5.3 (2026-03-09)
--
-- INSTRUÇÕES:
--   1. Supabase → SQL Editor → New Query
--   2. Cole TUDO → Run
--   3. NÃO APAGA DADOS - apenas adiciona campo
--
-- ✅ SEGURO PARA BANCO COM DADOS
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- PASSO 1: Adicionar coluna is_volatile_infinite em stock_items
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE stock_items
ADD COLUMN IF NOT EXISTS is_volatile_infinite BOOLEAN DEFAULT FALSE;

-- ─────────────────────────────────────────────────────────────────────────────
-- PASSO 2: Criar índice para performance (buscas por volatilidade)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_stock_items_volatile 
ON stock_items (is_volatile_infinite) 
WHERE is_volatile_infinite = TRUE;

-- ─────────────────────────────────────────────────────────────────────────────
-- PASSO 3: Registrar migração
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO app_settings (key, value)
VALUES ('last_migration', jsonb_build_object(
    'version', '5.3',
    'date', NOW()::text,
    'description', 'Added is_volatile_infinite field to stock_items',
    'status', 'completed'
))
ON CONFLICT (key) DO UPDATE
SET value = jsonb_build_object(
    'version', '5.3',
    'date', NOW()::text,
    'description', 'Added is_volatile_infinite field to stock_items',
    'status', 'completed'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- PASSO 4: Verificação
-- ─────────────────────────────────────────────────────────────────────────────
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name='stock_items' 
AND column_name='is_volatile_infinite'
LIMIT 1;

SELECT 'MIGRAÇÃO CONCLUÍDA! Campo is_volatile_infinite adicionado a stock_items' AS resultado;

-- ============================================================================
-- FIM — MIGRATION v5.3 (2026-03-09)
-- ============================================================================
