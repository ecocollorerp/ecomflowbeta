-- ═══════════════════════════════════════════════════════════════
-- MIGRATION_VOLATILE_RESET.sql
-- Adiciona função para reset manual do modo volátil
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION reset_volatile_status(
    p_item_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE product_boms
       SET is_volatile_infinite = FALSE
     WHERE code = p_item_code;

    RETURN jsonb_build_object(
        'success', true,
        'item_code', p_item_code,
        'message', 'Modo volátil desativado com sucesso.'
    );
END;
$$;
