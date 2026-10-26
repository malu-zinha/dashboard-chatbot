-- =====================================================
-- FIX: listar_areas_disponiveis - campo tempo_trabalho_dias
-- =====================================================
-- Corrige o nome do campo retornado para corresponder ao código TypeScript
-- =====================================================

CREATE OR REPLACE FUNCTION listar_areas_disponiveis()
RETURNS JSON AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'area_id', area_id,
            'codigo', codigo,
            'descricao', descricao,
            'tempo_trabalho_dias', tempo_trabalho_dias
        ) ORDER BY descricao
    ) INTO v_result
    FROM areas
    WHERE ativo = true;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION listar_areas_disponiveis IS 'Lista todas as áreas ativas com tempo estimado em dias';

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================

SELECT '✅ Função listar_areas_disponiveis atualizada!' as mensagem;

-- Testar a função
SELECT listar_areas_disponiveis();

-- Ver resultado formatado
SELECT 
    area_id,
    codigo,
    descricao,
    tempo_trabalho_dias
FROM areas
WHERE ativo = true
ORDER BY descricao
LIMIT 10;

