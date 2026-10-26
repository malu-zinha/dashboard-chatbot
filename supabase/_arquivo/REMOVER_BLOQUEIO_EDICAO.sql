-- =====================================================
-- REMOVER RESTRIÇÃO DE EDIÇÃO EM PREVISÕES
-- =====================================================
-- Remove o bloqueio de edição nas previsões
-- Tudo fica editável, pois as notificações são automáticas
-- =====================================================

-- 1. Remove o trigger que bloqueia edições
DROP TRIGGER IF EXISTS trg_validar_edicao_previsao ON projetos_previsao;

-- 2. Remove a função (opcional, pode deixar mas sem o trigger não faz nada)
DROP FUNCTION IF EXISTS validar_edicao_previsao();

-- 3. Atualiza função registrar_previsao_dia (simplificada)
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
    SELECT id INTO v_previsao_existente
    FROM projetos_previsao 
    WHERE eng_projeto_id = p_atribuicao_id 
    AND data_registro = CURRENT_DATE
    LIMIT 1;
    
    -- Se já existe, ATUALIZA
    IF v_previsao_existente IS NOT NULL THEN
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
            'mensagem', 'Previsão atualizada',
            'previsao_id', v_previsao_id,
            'data', CURRENT_DATE
        );
    END IF;
    
    -- Se não existe, INSERE
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
        true
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
        'mensagem', 'Previsão registrada',
        'previsao_id', v_previsao_id,
        'data', CURRENT_DATE
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION registrar_previsao_dia IS 'Registra ou atualiza previsão matinal (sempre editável)';

-- =====================================================
-- LIMPAR CAMPOS DESNECESSÁRIOS
-- =====================================================

-- Remove bloqueios existentes (para limpar dados antigos)
UPDATE projetos_previsao
SET 
    editavel = true,
    data_fim_dia = NULL
WHERE editavel = false;

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================

SELECT '✅ Restrições de edição REMOVIDAS!' as mensagem;
SELECT 'Todas as previsões agora são sempre editáveis' as descricao;

-- Verifica que o trigger foi removido
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.triggers 
            WHERE trigger_name = 'trg_validar_edicao_previsao'
        )
        THEN '❌ Trigger ainda existe'
        ELSE '✅ Trigger removido com sucesso'
    END as status_trigger;

