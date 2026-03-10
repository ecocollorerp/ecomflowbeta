-- ═══════════════════════════════════════════════════════════════
-- MIGRATION_VOLATILE_READY_STOCK.sql
-- Adiciona modo volátil automático ao Estoque Pronto
-- 
-- O que faz:
--   1. Adiciona is_volatile_infinite em product_boms
--   2. Cria RPC register_ready_stock que:
--       - Verifica se há insumos suficientes na BOM
--       - Se SIM: desconta insumos + incrementa ready_qty
--       - Se NÃO: ativa is_volatile_infinite = TRUE + incrementa
--                 ready_qty sem descontar insumos
-- ═══════════════════════════════════════════════════════════════

-- PASSO 1: Adicionar campo is_volatile_infinite em product_boms
ALTER TABLE product_boms
ADD COLUMN IF NOT EXISTS is_volatile_infinite BOOLEAN DEFAULT FALSE;

-- PASSO 2: Criar índice de performance
CREATE INDEX IF NOT EXISTS idx_product_boms_volatile
ON product_boms (is_volatile_infinite)
WHERE is_volatile_infinite = TRUE;

-- PASSO 3: Criar/substituir função register_ready_stock
CREATE OR REPLACE FUNCTION register_ready_stock(
    p_item_code  TEXT,
    p_quantity   REAL,
    p_ref        TEXT,
    p_user_name  TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    bom_items          JSONB;
    bom_item           JSONB;
    insumo_code        TEXT;
    qty_needed         REAL;
    insumo_available   REAL;
    has_enough_stock   BOOLEAN := TRUE;
    is_already_volatile BOOLEAN := FALSE;
    activated_volatile BOOLEAN := FALSE;
BEGIN
    -- 1. Verificar se o produto já está em modo volátil
    SELECT COALESCE(is_volatile_infinite, FALSE)
      INTO is_already_volatile
      FROM product_boms
     WHERE code = p_item_code;

    IF NOT is_already_volatile THEN
        -- 2. Buscar itens da BOM (campo "items" em product_boms)
        SELECT items INTO bom_items
          FROM product_boms
         WHERE code = p_item_code;

        -- 3. Checar disponibilidade de todos os insumos
        IF bom_items IS NOT NULL AND jsonb_array_length(bom_items) > 0 THEN
            FOR bom_item IN SELECT * FROM jsonb_array_elements(bom_items)
            LOOP
                -- Suporta ambos os formatos de chave: Bling (stockItemCode) e Interno (insumo_code)
                insumo_code := COALESCE(bom_item->>'insumo_code', bom_item->>'stockItemCode');
                qty_needed  := COALESCE((bom_item->>'quantity')::real, (bom_item->>'qty_per_pack')::real) * p_quantity;

                IF insumo_code IS NULL OR qty_needed IS NULL THEN
                    CONTINUE;
                END IF;

                SELECT current_qty INTO insumo_available
                  FROM stock_items
                 WHERE code = insumo_code;

                IF insumo_available IS NULL OR insumo_available < qty_needed THEN
                    has_enough_stock := FALSE;
                    EXIT;
                END IF;
            END LOOP;
        ELSE
            -- Sem BOM configurada → não tem como saber os insumos; ativa volátil
            has_enough_stock := FALSE;
        END IF;

        -- 4. Se insumos insuficientes, ativar modo volátil no produto
        -- Se insumos SUFICIENTES, desativar modo volátil (AUTO-RESET)
        IF NOT has_enough_stock THEN
            UPDATE product_boms
               SET is_volatile_infinite = TRUE
             WHERE code = p_item_code;
            activated_volatile := TRUE;
        ELSE
            UPDATE product_boms
               SET is_volatile_infinite = FALSE
             WHERE code = p_item_code;
        END IF;
    END IF;

    -- 5. Incrementar ready_qty (sempre, independente do modo)
    UPDATE product_boms
       SET ready_qty = COALESCE(ready_qty, 0) + p_quantity
     WHERE code = p_item_code;

    -- 6. Se não estiver em modo volátil (nem recém-ativado), descontar insumos
    IF NOT is_already_volatile AND NOT activated_volatile AND bom_items IS NOT NULL THEN
        FOR bom_item IN SELECT * FROM jsonb_array_elements(bom_items)
        LOOP
            insumo_code := COALESCE(bom_item->>'insumo_code', bom_item->>'stockItemCode');
            qty_needed  := COALESCE((bom_item->>'quantity')::real, (bom_item->>'qty_per_pack')::real) * p_quantity;

            IF insumo_code IS NOT NULL AND qty_needed IS NOT NULL AND EXISTS (SELECT 1 FROM stock_items WHERE code = insumo_code) THEN
                PERFORM adjust_stock_quantity(
                    insumo_code,
                    -qty_needed,
                    'PRODUCAO_MANUAL',
                    p_ref || ' (Consumo de Insumo)',
                    p_user_name
                );
            END IF;
        END LOOP;
    END IF;

    RETURN jsonb_build_object(
        'success',            true,
        'activated_volatile', activated_volatile,
        'was_volatile',       is_already_volatile,
        'deducted_insumos',   (NOT is_already_volatile AND NOT activated_volatile AND bom_items IS NOT NULL)
    );
END;
$$;

-- Verificação final
SELECT 
    'Migração VOLATILE_READY_STOCK concluída!' AS resultado,
    EXISTS(
        SELECT 1 FROM information_schema.columns
         WHERE table_name = 'product_boms'
           AND column_name = 'is_volatile_infinite'
    ) AS campo_adicionado,
    EXISTS(
        SELECT 1 FROM pg_proc WHERE proname = 'register_ready_stock'
    ) AS funcao_criada;
