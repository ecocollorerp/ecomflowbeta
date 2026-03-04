-- =============================================================
-- MIGRAÇÃO ERP - Execute este script no SQL Editor do Supabase
-- =============================================================

-- ── 1. Criar a constraint UNIQUE em orders (necessária para o upsert) ──────
-- Se a tabela não tiver a constraint (order_id, sku), o upsert retorna 400.
-- Execute apenas uma vez; o IF NOT EXISTS evita erros em execuções repetidas.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_order_id_sku_key'
      AND conrelid = 'orders'::regclass
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT orders_order_id_sku_key UNIQUE (order_id, sku);
    RAISE NOTICE 'Constraint orders_order_id_sku_key criada.';
  ELSE
    RAISE NOTICE 'Constraint orders_order_id_sku_key já existe, ignorando.';
  END IF;
END $$;

-- ── 2. Garantir que a coluna canal aceita ML / SHOPEE / SITE ────────────────
-- Se canal for TEXT, nenhuma ação é necessária.
-- Se for um ENUM (tipo personalizado), adiciona os valores necessários.

DO $$ BEGIN
  -- Tenta adicionar 'ML' ao enum se existir; ignora se for TEXT
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'canal_type') THEN
    BEGIN
      ALTER TYPE canal_type ADD VALUE IF NOT EXISTS 'ML';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER TYPE canal_type ADD VALUE IF NOT EXISTS 'SHOPEE';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER TYPE canal_type ADD VALUE IF NOT EXISTS 'SITE';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER TYPE canal_type ADD VALUE IF NOT EXISTS 'AUTO';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    RAISE NOTICE 'Valores do enum canal_type verificados/atualizados.';
  ELSE
    RAISE NOTICE 'Coluna canal parece ser TEXT — nenhuma alteração necessária.';
  END IF;
END $$;

-- ── 3. Colunas extras que o handleLaunchSuccess usa ────────────────────────
-- Se alguma coluna estiver faltando, adiciona com valor default nulo.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS data_prevista_envio TEXT,
  ADD COLUMN IF NOT EXISTS price_gross         NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS platform_fees       NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_fee        NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_net           NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tracking            TEXT,
  ADD COLUMN IF NOT EXISTS multiplicador       NUMERIC DEFAULT 1,
  ADD COLUMN IF NOT EXISTS qty_original        NUMERIC DEFAULT 1,
  ADD COLUMN IF NOT EXISTS qty_final           NUMERIC DEFAULT 1,
  ADD COLUMN IF NOT EXISTS color               TEXT,
  ADD COLUMN IF NOT EXISTS canal               TEXT,
  ADD COLUMN IF NOT EXISTS customer_cpf_cnpj   TEXT;

-- ── 4. Verificação final ────────────────────────────────────────────────────
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'orders'
ORDER BY ordinal_position;
