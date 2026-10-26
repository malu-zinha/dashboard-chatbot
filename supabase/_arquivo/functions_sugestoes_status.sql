-- =====================================================
-- FUNCTIONS PARA SUGESTÕES INTELIGENTES DE STATUS
-- Sistema de autocomplete para previsões e feitos
-- =====================================================

-- =====================================================
-- FUNCTION: sugerir_previsoes_por_status
-- Sugere atividades de previsão baseadas no status atual
-- =====================================================

CREATE OR REPLACE FUNCTION sugerir_previsoes_por_status(
    p_status_codigo TEXT
)
RETURNS JSON AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_build_object(
        'status', p_status_codigo,
        'status_nome', (SELECT descricao FROM status_codes WHERE codigo = p_status_codigo),
        'significado', (SELECT descricao FROM status_detalhamento 
                       WHERE status_codigo = p_status_codigo AND tipo = 'SIGNIFICADO' 
                       LIMIT 1),
        'sugestoes', (
            SELECT json_agg(
                json_build_object(
                    'ordem', ordem,
                    'atividade', descricao
                ) ORDER BY ordem
            )
            FROM status_detalhamento
            WHERE status_codigo = p_status_codigo AND tipo = 'PREVISAO'
        )
    ) INTO v_result;
    
    RETURN COALESCE(v_result, json_build_object(
        'sucesso', false,
        'mensagem', 'Status não encontrado'
    ));
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION sugerir_previsoes_por_status IS 'Sugere atividades de previsão baseadas no status atual - para chatbot';

-- =====================================================
-- FUNCTION: sugerir_feitos_por_status
-- Sugere atividades de "feito" baseadas no status atual
-- =====================================================

CREATE OR REPLACE FUNCTION sugerir_feitos_por_status(
    p_status_codigo TEXT
)
RETURNS JSON AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_build_object(
        'status', p_status_codigo,
        'status_nome', (SELECT descricao FROM status_codes WHERE codigo = p_status_codigo),
        'significado', (SELECT descricao FROM status_detalhamento 
                       WHERE status_codigo = p_status_codigo AND tipo = 'SIGNIFICADO' 
                       LIMIT 1),
        'sugestoes', (
            SELECT json_agg(
                json_build_object(
                    'ordem', ordem,
                    'atividade', descricao
                ) ORDER BY ordem
            )
            FROM status_detalhamento
            WHERE status_codigo = p_status_codigo AND tipo = 'FEITO'
        )
    ) INTO v_result;
    
    RETURN COALESCE(v_result, json_build_object(
        'sucesso', false,
        'mensagem', 'Status não encontrado'
    ));
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION sugerir_feitos_por_status IS 'Sugere atividades de "feito" baseadas no status atual - para chatbot';

-- =====================================================
-- FUNCTION: registrar_previsao_dia_com_sugestoes
-- Versão melhorada que oferece sugestões automáticas
-- =====================================================

CREATE OR REPLACE FUNCTION registrar_previsao_dia_com_sugestoes(
    p_atribuicao_id UUID,
    p_previsao_texto TEXT DEFAULT NULL, -- Opcional: se vazio, retorna sugestões
    p_tempo_estimado INTEGER DEFAULT NULL,
    p_nova_data_prevista DATE DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_previsao_id UUID;
    v_projeto_id UUID;
    v_eng_id UUID;
    v_status_id INTEGER;
    v_status_codigo TEXT;
    v_sugestoes JSON;
BEGIN
    -- Valida atribuição
    IF NOT EXISTS (SELECT 1 FROM engenheiros_projetos WHERE id = p_atribuicao_id AND ativo = true) THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Atribuição não encontrada'
        );
    END IF;
    
    -- Busca dados da atribuição
    SELECT projeto_id, eng_id, status_id INTO v_projeto_id, v_eng_id, v_status_id
    FROM engenheiros_projetos
    WHERE id = p_atribuicao_id;
    
    -- Busca código do status
    SELECT codigo INTO v_status_codigo
    FROM status_codes
    WHERE status_id = v_status_id;
    
    -- Se não forneceu previsão, retorna sugestões
    IF p_previsao_texto IS NULL OR TRIM(p_previsao_texto) = '' THEN
        v_sugestoes := sugerir_previsoes_por_status(v_status_codigo);
        
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Previsão não fornecida. Veja as sugestões abaixo.',
            'status_atual', v_status_codigo,
            'sugestoes', v_sugestoes,
            'dica', 'Escolha uma atividade ou descreva o que você planeja fazer hoje'
        );
    END IF;
    
    -- Valida se já existe previsão para hoje
    IF EXISTS (
        SELECT 1 FROM projetos_previsao 
        WHERE eng_projeto_id = p_atribuicao_id 
        AND data_registro = CURRENT_DATE
    ) THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Já existe uma previsão cadastrada para hoje. Use atualizar_feito_dia para completar.'
        );
    END IF;
    
    -- Insere previsão
    INSERT INTO projetos_previsao (
        eng_projeto_id,
        projeto_id,
        eng_id,
        data_registro,
        previsao_texto,
        tempo_estimado,
        nova_data_prevista,
        status_id
    ) VALUES (
        p_atribuicao_id,
        v_projeto_id,
        v_eng_id,
        CURRENT_DATE,
        p_previsao_texto,
        p_tempo_estimado,
        p_nova_data_prevista,
        v_status_id
    ) RETURNING id INTO v_previsao_id;
    
    RETURN json_build_object(
        'sucesso', true,
        'mensagem', 'Previsão do dia registrada com sucesso!',
        'previsao_id', v_previsao_id,
        'data', CURRENT_DATE,
        'status_atual', v_status_codigo
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'sucesso', false,
        'mensagem', 'Erro ao registrar previsão: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION registrar_previsao_dia_com_sugestoes IS 'Registra previsão ou retorna sugestões baseadas no status';

-- =====================================================
-- FUNCTION: atualizar_feito_dia_com_sugestoes
-- Versão melhorada que oferece sugestões automáticas
-- =====================================================

CREATE OR REPLACE FUNCTION atualizar_feito_dia_com_sugestoes(
    p_atribuicao_id UUID,
    p_feito_texto TEXT DEFAULT NULL, -- Opcional: se vazio, retorna sugestões
    p_nova_data_prevista DATE DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_previsao_id UUID;
    v_status_id INTEGER;
    v_status_codigo TEXT;
    v_sugestoes JSON;
BEGIN
    -- Busca status atual
    SELECT status_id INTO v_status_id
    FROM engenheiros_projetos
    WHERE id = p_atribuicao_id;
    
    SELECT codigo INTO v_status_codigo
    FROM status_codes
    WHERE status_id = v_status_id;
    
    -- Se não forneceu feito, retorna sugestões
    IF p_feito_texto IS NULL OR TRIM(p_feito_texto) = '' THEN
        v_sugestoes := sugerir_feitos_por_status(v_status_codigo);
        
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'O que foi feito não foi fornecido. Veja as sugestões abaixo.',
            'status_atual', v_status_codigo,
            'sugestoes', v_sugestoes,
            'dica', 'Escolha uma atividade ou descreva o que você fez hoje'
        );
    END IF;
    
    -- Busca previsão de hoje
    SELECT id INTO v_previsao_id
    FROM projetos_previsao
    WHERE eng_projeto_id = p_atribuicao_id
    AND data_registro = CURRENT_DATE
    AND editavel = true;
    
    IF v_previsao_id IS NULL THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Não há previsão para hoje ou ela já foi finalizada'
        );
    END IF;
    
    -- Atualiza feito e nova data prevista (trigger tornará imutável)
    UPDATE projetos_previsao
    SET 
        feito_texto = p_feito_texto,
        nova_data_prevista = COALESCE(p_nova_data_prevista, nova_data_prevista)
    WHERE id = v_previsao_id;
    
    -- Atualiza data prevista na atribuição se fornecida
    IF p_nova_data_prevista IS NOT NULL THEN
        UPDATE engenheiros_projetos
        SET data_prevista = p_nova_data_prevista
        WHERE id = p_atribuicao_id;
    END IF;
    
    RETURN json_build_object(
        'sucesso', true,
        'mensagem', 'Feito do dia registrado! Registro agora é imutável.',
        'previsao_id', v_previsao_id,
        'nova_data_prevista', p_nova_data_prevista
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'sucesso', false,
        'mensagem', 'Erro ao atualizar feito: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION atualizar_feito_dia_com_sugestoes IS 'Registra feito ou retorna sugestões baseadas no status';

-- =====================================================
-- FUNCTION: listar_todos_status_com_info
-- Lista todos os status com significado para o chatbot
-- =====================================================

CREATE OR REPLACE FUNCTION listar_todos_status_com_info()
RETURNS JSON AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'codigo', codigo,
            'nome', descricao,
            'percentual', percentual_base,
            'ordem', ordem,
            'significado', (
                SELECT descricao 
                FROM status_detalhamento 
                WHERE status_codigo = sc.codigo 
                AND tipo = 'SIGNIFICADO' 
                LIMIT 1
            ),
            'qtd_sugestoes_previsao', (
                SELECT COUNT(*) 
                FROM status_detalhamento 
                WHERE status_codigo = sc.codigo 
                AND tipo = 'PREVISAO'
            ),
            'qtd_sugestoes_feito', (
                SELECT COUNT(*) 
                FROM status_detalhamento 
                WHERE status_codigo = sc.codigo 
                AND tipo = 'FEITO'
            )
        ) ORDER BY ordem
    ) INTO v_result
    FROM status_codes sc
    WHERE ativo = true;
    
    RETURN json_build_object(
        'sucesso', true,
        'total_status', (SELECT COUNT(*) FROM status_codes WHERE ativo = true),
        'status', v_result
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION listar_todos_status_com_info IS 'Lista todos os status com informações completas para o chatbot';

-- =====================================================
-- EXEMPLOS DE USO
-- =====================================================

/*
-- Exemplo 1: Listar todos os status
SELECT listar_todos_status_com_info();

-- Exemplo 2: Sugerir previsões para "Em Execução"
SELECT sugerir_previsoes_por_status('EM_EXECUCAO');

-- Exemplo 3: Sugerir feitos para "Parado Cliente"
SELECT sugerir_feitos_por_status('PARADO_CLIENTE');

-- Exemplo 4: Registrar previsão COM sugestões automáticas
SELECT registrar_previsao_dia_com_sugestoes(
    p_atribuicao_id := 'uuid-atribuicao',
    p_previsao_texto := NULL -- NULL = retorna sugestões
);

-- Exemplo 5: Registrar previsão escolhendo sugestão
SELECT registrar_previsao_dia_com_sugestoes(
    p_atribuicao_id := 'uuid-atribuicao',
    p_previsao_texto := 'Realizar traçado preliminar'
);

-- Exemplo 6: Registrar feito COM sugestões
SELECT atualizar_feito_dia_com_sugestoes(
    p_atribuicao_id := 'uuid-atribuicao',
    p_feito_texto := NULL -- NULL = retorna sugestões
);

-- Exemplo 7: Registrar feito escolhendo sugestão
SELECT atualizar_feito_dia_com_sugestoes(
    p_atribuicao_id := 'uuid-atribuicao',
    p_feito_texto := 'Traçado preliminar concluído',
    p_nova_data_prevista := '2025-12-25'
);
*/




