-- =====================================================
-- FIX: Permitir múltiplas previsões no mesmo dia
-- =====================================================
-- Remove a restrição de "apenas uma previsão por dia"
-- e permite que o engenheiro atualize a previsão quantas vezes quiser
-- até o fim do dia (quando preencher feito_texto)
-- =====================================================

CREATE OR REPLACE FUNCTION registrar_previsao_dia(
    p_atribuicao_id UUID,
    p_previsao_texto TEXT,
    p_tempo_estimado INTEGER DEFAULT NULL,
    p_nova_data_prevista DATE DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_previsao_id UUID;
    v_projeto_id UUID;
    v_eng_id UUID;
    v_status_id INTEGER;
    v_previsao_existente UUID;
    v_editavel BOOLEAN;
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
    
    -- Verifica se já existe previsão para hoje
    SELECT id, editavel
    INTO v_previsao_existente, v_editavel
    FROM projetos_previsao 
    WHERE eng_projeto_id = p_atribuicao_id 
    AND data_registro = CURRENT_DATE
    LIMIT 1;
    
    -- Se já existe e ainda é editável, ATUALIZA ao invés de inserir
    IF v_previsao_existente IS NOT NULL THEN
        IF v_editavel = false THEN
            RETURN json_build_object(
                'sucesso', false,
                'mensagem', 'A previsão de hoje já foi finalizada (notificação noturna). Não é mais possível editar.'
            );
        END IF;
        
        -- Atualiza a previsão existente
        UPDATE projetos_previsao
        SET 
            previsao_texto = p_previsao_texto,
            tempo_estimado = COALESCE(p_tempo_estimado, tempo_estimado),
            nova_data_prevista = COALESCE(p_nova_data_prevista, nova_data_prevista),
            status_id = v_status_id,
            updated_at = NOW()
        WHERE id = v_previsao_existente
        RETURNING id INTO v_previsao_id;
        
        RETURN json_build_object(
            'sucesso', true,
            'mensagem', 'Previsão atualizada com sucesso',
            'previsao_id', v_previsao_id,
            'data', CURRENT_DATE
        );
    END IF;
    
    -- Se não existe, INSERE nova previsão
    INSERT INTO projetos_previsao (
        eng_projeto_id,
        projeto_id,
        eng_id,
        data_registro,
        previsao_texto,
        tempo_estimado,
        nova_data_prevista,
        status_id,
        editavel
    ) VALUES (
        p_atribuicao_id,
        v_projeto_id,
        v_eng_id,
        CURRENT_DATE,
        p_previsao_texto,
        p_tempo_estimado,
        p_nova_data_prevista,
        v_status_id,
        true -- Editável até preencher feito_texto
    )
    RETURNING id INTO v_previsao_id;
    
    -- Atualiza data prevista se fornecida
    IF p_nova_data_prevista IS NOT NULL THEN
        UPDATE engenheiros_projetos
        SET 
            data_prevista = p_nova_data_prevista,
            updated_at = NOW()
        WHERE id = p_atribuicao_id;
    END IF;
    
    RETURN json_build_object(
        'sucesso', true,
        'mensagem', 'Previsão registrada com sucesso',
        'previsao_id', v_previsao_id,
        'data', CURRENT_DATE
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION registrar_previsao_dia IS 'Registra ou atualiza previsão matinal (editável até notificação noturna)';

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================

SELECT '✅ Função registrar_previsao_dia atualizada!' as mensagem;
SELECT 'Agora permite atualizar a previsão matinal quantas vezes quiser até o fim do dia' as descricao;

