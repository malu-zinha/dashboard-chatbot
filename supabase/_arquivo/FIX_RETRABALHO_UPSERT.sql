-- =====================================================
-- FIX: registrar_retrabalho_dia com UPSERT
-- =====================================================
-- Permite registrar/atualizar retrabalho mesmo que já exista para hoje
-- =====================================================

CREATE OR REPLACE FUNCTION registrar_retrabalho_dia(
    p_atribuicao_id UUID,
    p_necessitou_retrabalho BOOLEAN,
    p_motivo_retrabalho TEXT DEFAULT NULL,
    p_tipo_retrabalho TEXT DEFAULT NULL,
    p_descricao TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_retrabalho_id UUID;
    v_projeto_id UUID;
    v_eng_id UUID;
    v_status_id INTEGER;
    v_quantidade INTEGER;
    v_existe_hoje BOOLEAN;
BEGIN
    -- Valida atribuição
    IF NOT EXISTS (SELECT 1 FROM engenheiros_projetos WHERE id = p_atribuicao_id AND ativo = true) THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Atribuição não encontrada'
        );
    END IF;
    
    -- Busca dados da atribuição
    SELECT projeto_id, eng_id, status_id
    INTO v_projeto_id, v_eng_id, v_status_id
    FROM engenheiros_projetos
    WHERE id = p_atribuicao_id;
    
    -- Verifica se já existe registro para hoje
    SELECT EXISTS (
        SELECT 1 FROM retrabalho_projetos 
        WHERE eng_projeto_id = p_atribuicao_id 
        AND data_retrabalho = CURRENT_DATE
    ) INTO v_existe_hoje;
    
    IF v_existe_hoje THEN
        -- ✅ ATUALIZA o registro existente
        UPDATE retrabalho_projetos
        SET 
            necessitou_retrabalho = p_necessitou_retrabalho,
            motivo_retrabalho = p_motivo_retrabalho,
            tipo_retrabalho = p_tipo_retrabalho,
            descricao = p_descricao
        WHERE eng_projeto_id = p_atribuicao_id 
        AND data_retrabalho = CURRENT_DATE
        RETURNING id INTO v_retrabalho_id;
        
    ELSE
        -- ✅ INSERE novo registro
        INSERT INTO retrabalho_projetos (
            eng_projeto_id,
            projeto_id,
            eng_id,
            necessitou_retrabalho,
            motivo_retrabalho,
            tipo_retrabalho,
            descricao,
            data_retrabalho,
            status_id
        ) VALUES (
            p_atribuicao_id,
            v_projeto_id,
            v_eng_id,
            p_necessitou_retrabalho,
            p_motivo_retrabalho,
            p_tipo_retrabalho,
            p_descricao,
            CURRENT_DATE,
            v_status_id
        )
        RETURNING id INTO v_retrabalho_id;
    END IF;
    
    -- Conta total de retrabalhos desta atribuição
    SELECT COUNT(*) INTO v_quantidade
    FROM retrabalho_projetos
    WHERE eng_projeto_id = p_atribuicao_id
    AND necessitou_retrabalho = true;
    
    RETURN json_build_object(
        'sucesso', true,
        'mensagem', CASE 
            WHEN v_existe_hoje THEN 'Registro de retrabalho atualizado'
            ELSE 'Registro de retrabalho criado'
        END,
        'retrabalho_id', v_retrabalho_id,
        'necessitou_retrabalho', p_necessitou_retrabalho,
        'quantidade_total_retrabalhos', v_quantidade,
        'data', CURRENT_DATE
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION registrar_retrabalho_dia IS 'Registra ou atualiza retrabalho do dia (UPSERT)';

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================

SELECT '✅ Função registrar_retrabalho_dia atualizada com UPSERT!' as mensagem;

-- Teste: Registrar retrabalho para hoje
DO $$
DECLARE
    v_eng_projeto_id UUID;
    v_resultado JSON;
BEGIN
    -- Pegar primeira atribuição ativa
    SELECT id INTO v_eng_projeto_id
    FROM engenheiros_projetos
    WHERE ativo = true
    LIMIT 1;
    
    IF v_eng_projeto_id IS NOT NULL THEN
        -- Primeiro registro
        SELECT registrar_retrabalho_dia(
            v_eng_projeto_id,
            true,
            'Teste de UPSERT - primeira vez',
            'teste',
            'Testando função'
        ) INTO v_resultado;
        
        RAISE NOTICE 'Resultado 1: %', v_resultado;
        
        -- Segundo registro (deve atualizar, não dar erro)
        SELECT registrar_retrabalho_dia(
            v_eng_projeto_id,
            false,
            NULL,
            NULL,
            'Atualização - sem retrabalho'
        ) INTO v_resultado;
        
        RAISE NOTICE 'Resultado 2 (atualização): %', v_resultado;
    END IF;
END $$;

-- Ver resultado
SELECT 
    data_retrabalho,
    necessitou_retrabalho,
    motivo_retrabalho,
    descricao,
    created_at
FROM retrabalho_projetos
WHERE data_retrabalho = CURRENT_DATE
ORDER BY created_at DESC
LIMIT 5;

