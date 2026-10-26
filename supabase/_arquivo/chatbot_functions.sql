-- =====================================================
-- FUNCTIONS PARA INTEGRAÇÃO COM CHATBOT
-- Sistema de alimentação via prompts em linguagem natural
-- =====================================================

-- =====================================================
-- TABELA: chatbot_logs
-- Registra todas as interações do chatbot com o banco
-- =====================================================

CREATE TABLE IF NOT EXISTS chatbot_logs (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    eng_id UUID REFERENCES engenheiros(eng_id),
    prompt_original TEXT NOT NULL,
    acao_executada TEXT,
    comando_sql TEXT,
    sucesso BOOLEAN DEFAULT true,
    mensagem_retorno TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_chatbot_logs_eng_id ON chatbot_logs(eng_id);
CREATE INDEX idx_chatbot_logs_created ON chatbot_logs(created_at);

COMMENT ON TABLE chatbot_logs IS 'Log de todas as interações do chatbot com o banco de dados';

-- =====================================================
-- FUNCTION: cadastrar_engenheiro
-- Cadastra novo engenheiro via chatbot
-- =====================================================

CREATE OR REPLACE FUNCTION cadastrar_engenheiro(
    p_nome TEXT,
    p_exclusivo BOOLEAN DEFAULT false
)
RETURNS JSON AS $$
DECLARE
    v_eng_id UUID;
    v_result JSON;
BEGIN
    -- Validação
    IF p_nome IS NULL OR TRIM(p_nome) = '' THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Nome do engenheiro é obrigatório'
        );
    END IF;
    
    -- Verifica se já existe
    SELECT eng_id INTO v_eng_id 
    FROM engenheiros 
    WHERE LOWER(nome) = LOWER(TRIM(p_nome)) AND ativo = true;
    
    IF v_eng_id IS NOT NULL THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Engenheiro já cadastrado',
            'eng_id', v_eng_id
        );
    END IF;
    
    -- Insere
    INSERT INTO engenheiros (nome, exclusivo)
    VALUES (TRIM(p_nome), p_exclusivo)
    RETURNING eng_id INTO v_eng_id;
    
    -- Retorna resultado
    RETURN json_build_object(
        'sucesso', true,
        'mensagem', 'Engenheiro cadastrado com sucesso!',
        'eng_id', v_eng_id,
        'nome', TRIM(p_nome),
        'exclusivo', p_exclusivo
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'sucesso', false,
        'mensagem', 'Erro ao cadastrar: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cadastrar_engenheiro IS 'Cadastra novo engenheiro via chatbot';

-- =====================================================
-- FUNCTION: atualizar_engenheiro
-- Permite engenheiro editar nome ou exclusividade
-- =====================================================

CREATE OR REPLACE FUNCTION atualizar_engenheiro(
    p_eng_id UUID,
    p_nome TEXT DEFAULT NULL,
    p_exclusivo BOOLEAN DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_updated_fields TEXT[] := ARRAY[]::TEXT[];
BEGIN
    -- Verifica se engenheiro existe
    IF NOT EXISTS (SELECT 1 FROM engenheiros WHERE eng_id = p_eng_id AND ativo = true) THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Engenheiro não encontrado'
        );
    END IF;
    
    -- Atualiza nome se fornecido
    IF p_nome IS NOT NULL THEN
        UPDATE engenheiros 
        SET nome = TRIM(p_nome)
        WHERE eng_id = p_eng_id;
        v_updated_fields := array_append(v_updated_fields, 'nome');
    END IF;
    
    -- Atualiza exclusividade se fornecida
    IF p_exclusivo IS NOT NULL THEN
        UPDATE engenheiros 
        SET exclusivo = p_exclusivo
        WHERE eng_id = p_eng_id;
        v_updated_fields := array_append(v_updated_fields, 'exclusivo');
    END IF;
    
    RETURN json_build_object(
        'sucesso', true,
        'mensagem', 'Dados atualizados com sucesso',
        'campos_atualizados', v_updated_fields
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'sucesso', false,
        'mensagem', 'Erro ao atualizar: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCTION: criar_projeto
-- Cria novo projeto via chatbot
-- =====================================================

CREATE OR REPLACE FUNCTION criar_projeto(
    p_codigo TEXT,
    p_cliente TEXT,
    p_descricao TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_projeto_id UUID;
    v_projeto_ativo BOOLEAN;
    v_codigo TEXT;
    v_cliente TEXT;
    v_descricao TEXT;
    v_reativado BOOLEAN := false;
BEGIN
    v_codigo := UPPER(TRIM(COALESCE(p_codigo, '')));
    v_cliente := TRIM(COALESCE(p_cliente, ''));
    v_descricao := NULLIF(TRIM(COALESCE(p_descricao, '')), '');

    IF v_codigo = '' THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Codigo do projeto e obrigatorio'
        );
    END IF;

    IF v_cliente = '' THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Nome do cliente e obrigatorio'
        );
    END IF;

    SELECT projeto_id, ativo INTO v_projeto_id, v_projeto_ativo
    FROM projetos
    WHERE codigo_projeto = v_codigo
    FOR UPDATE;

    IF v_projeto_id IS NOT NULL AND v_projeto_ativo = true THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Codigo de projeto ja existe'
        );
    END IF;

    IF v_projeto_id IS NOT NULL AND v_projeto_ativo = false THEN
        UPDATE projetos
        SET
            ativo = true,
            cliente = v_cliente,
            descricao = v_descricao,
            updated_at = NOW()
        WHERE projeto_id = v_projeto_id;

        UPDATE engenheiros_projetos
        SET
            ativo = false,
            updated_at = NOW()
        WHERE projeto_id = v_projeto_id
          AND ativo = true;

        UPDATE evandro_distribuicao_tasks
        SET
            ativo = false,
            updated_at = NOW()
        WHERE projeto_id = v_projeto_id
          AND ativo = true;

        UPDATE notificacoes_whatsapp
        SET
            enviada = true,
            data_envio = COALESCE(data_envio, NOW()),
            erro_envio = COALESCE(erro_envio, 'Cancelada por exclusao do projeto')
        WHERE projeto_id = v_projeto_id
          AND enviada = false;

        DELETE FROM projeto_etapas_globais
        WHERE projeto_id = v_projeto_id;

        DELETE FROM projeto_pavimentos
        WHERE projeto_id = v_projeto_id;

        v_reativado := true;
    ELSE
        INSERT INTO projetos (codigo_projeto, cliente, descricao, ativo)
        VALUES (v_codigo, v_cliente, v_descricao, true)
        RETURNING projeto_id INTO v_projeto_id;
    END IF;

    RETURN json_build_object(
        'sucesso', true,
        'mensagem', CASE
            WHEN v_reativado THEN 'Projeto reativado com sucesso!'
            ELSE 'Projeto criado com sucesso!'
        END,
        'projeto_id', v_projeto_id,
        'codigo', v_codigo,
        'cliente', v_cliente,
        'reativado', v_reativado
    );

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'sucesso', false,
        'mensagem', 'Erro ao criar projeto: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql;
-- =====================================================
-- FUNCTION: atribuir_area_projeto
-- Atribui engenheiro a projeto com área específica
-- AUTOMÁTICO: calcula tempo_trabalho e percentual
-- =====================================================

CREATE OR REPLACE FUNCTION atribuir_area_projeto(
    p_eng_id UUID,
    p_projeto_id UUID,
    p_area_codigo TEXT,
    p_data_inicio DATE DEFAULT CURRENT_DATE,
    p_data_prevista DATE DEFAULT NULL,
    p_status_codigo TEXT DEFAULT 'AGUARDANDO_INICIO'
)
RETURNS JSON AS $$
DECLARE
    v_area_id INTEGER;
    v_status_id INTEGER;
    v_atribuicao_id UUID;
    v_tempo_trabalho INTEGER;
    v_percentual NUMERIC;
BEGIN
    -- Valida engenheiro
    IF NOT EXISTS (SELECT 1 FROM engenheiros WHERE eng_id = p_eng_id AND ativo = true) THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Engenheiro não encontrado'
        );
    END IF;
    
    -- Valida projeto
    IF NOT EXISTS (SELECT 1 FROM projetos WHERE projeto_id = p_projeto_id AND ativo = true) THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Projeto não encontrado'
        );
    END IF;
    
    -- Busca área
    SELECT area_id INTO v_area_id
    FROM areas 
    WHERE UPPER(codigo) = UPPER(TRIM(p_area_codigo)) AND ativo = true;
    
    IF v_area_id IS NULL THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Área não encontrada. Áreas disponíveis: ELETRICO, HIDRAULICO, ESTRUTURAL, etc.'
        );
    END IF;
    
    -- Busca status
    SELECT status_id INTO v_status_id
    FROM status_codes
    WHERE UPPER(codigo) = UPPER(TRIM(p_status_codigo)) AND ativo = true;
    
    IF v_status_id IS NULL THEN
        v_status_id := (SELECT status_id FROM status_codes WHERE codigo = 'AGUARDANDO_INICIO');
    END IF;
    
    -- Verifica duplicidade
    IF EXISTS (
        SELECT 1 FROM engenheiros_projetos 
        WHERE eng_id = p_eng_id 
        AND projeto_id = p_projeto_id 
        AND area_id = v_area_id 
        AND ativo = true
    ) THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Engenheiro já está atribuído a esta área neste projeto'
        );
    END IF;
    
    -- Insere atribuição (triggers calculam tempo e percentual automaticamente)
    INSERT INTO engenheiros_projetos (
        eng_id, 
        projeto_id, 
        area_id, 
        data_inicio, 
        data_prevista,
        status_id
    ) VALUES (
        p_eng_id,
        p_projeto_id,
        v_area_id,
        COALESCE(p_data_inicio, CURRENT_DATE),
        p_data_prevista,
        v_status_id
    ) RETURNING id, tempo_trabalho_dias, percentual_andamento 
    INTO v_atribuicao_id, v_tempo_trabalho, v_percentual;
    
    RETURN json_build_object(
        'sucesso', true,
        'mensagem', 'Área atribuída com sucesso! Tempo e percentual calculados automaticamente.',
        'atribuicao_id', v_atribuicao_id,
        'tempo_trabalho_dias', v_tempo_trabalho,
        'percentual_andamento', v_percentual
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'sucesso', false,
        'mensagem', 'Erro ao atribuir área: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCTION: atualizar_status_projeto
-- Atualiza status (percentual é calculado automaticamente)
-- =====================================================

CREATE OR REPLACE FUNCTION atualizar_status_projeto(
    p_atribuicao_id UUID,
    p_status_codigo TEXT
)
RETURNS JSON AS $$
DECLARE
    v_status_id INTEGER;
    v_percentual NUMERIC;
BEGIN
    -- Busca status
    SELECT status_id INTO v_status_id
    FROM status_codes
    WHERE UPPER(codigo) = UPPER(TRIM(p_status_codigo)) AND ativo = true;
    
    IF v_status_id IS NULL THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Status não encontrado. Use: AGUARDANDO_INICIO, EM_PLANEJAMENTO, etc.'
        );
    END IF;
    
    -- Atualiza (trigger calcula percentual automaticamente)
    UPDATE engenheiros_projetos
    SET status_id = v_status_id
    WHERE id = p_atribuicao_id AND ativo = true
    RETURNING percentual_andamento INTO v_percentual;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Atribuição não encontrada'
        );
    END IF;
    
    RETURN json_build_object(
        'sucesso', true,
        'mensagem', 'Status atualizado! Percentual calculado automaticamente.',
        'percentual_andamento', v_percentual
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'sucesso', false,
        'mensagem', 'Erro ao atualizar status: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCTION: atualizar_previsao
-- Atualiza data prevista (atualização diária)
-- =====================================================

CREATE OR REPLACE FUNCTION atualizar_previsao(
    p_atribuicao_id UUID,
    p_nova_data DATE
)
RETURNS JSON AS $$
BEGIN
    UPDATE engenheiros_projetos
    SET data_prevista = p_nova_data
    WHERE id = p_atribuicao_id AND ativo = true;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Atribuição não encontrada'
        );
    END IF;
    
    -- Registra no histórico
    INSERT INTO projetos_previsao (eng_projeto_id, data_previsao)
    VALUES (p_atribuicao_id, p_nova_data);
    
    RETURN json_build_object(
        'sucesso', true,
        'mensagem', 'Previsão atualizada com sucesso!',
        'nova_data', p_nova_data
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'sucesso', false,
        'mensagem', 'Erro ao atualizar previsão: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCTION: registrar_retrabalho
-- Registra necessidade de retrabalho
-- =====================================================

CREATE OR REPLACE FUNCTION registrar_retrabalho(
    p_atribuicao_id UUID,
    p_motivo TEXT,
    p_descricao TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_retrabalho_id UUID;
BEGIN
    INSERT INTO retrabalho_projetos (
        eng_projeto_id,
        necessitou_retrabalho,
        motivo,
        descricao,
        data_retrabalho
    ) VALUES (
        p_atribuicao_id,
        true,
        p_motivo,
        p_descricao,
        CURRENT_DATE
    ) RETURNING id INTO v_retrabalho_id;
    
    RETURN json_build_object(
        'sucesso', true,
        'mensagem', 'Retrabalho registrado',
        'retrabalho_id', v_retrabalho_id
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'sucesso', false,
        'mensagem', 'Erro ao registrar retrabalho: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCTION: buscar_meus_projetos
-- Retorna projetos do engenheiro (para o chatbot mostrar)
-- =====================================================

CREATE OR REPLACE FUNCTION buscar_meus_projetos(
    p_eng_id UUID
)
RETURNS JSON AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'projeto_codigo', codigo_projeto,
            'cliente', cliente,
            'area', area_descricao,
            'data_inicio', data_inicio,
            'data_prevista', data_prevista,
            'status', status_descricao,
            'percentual', percentual_andamento,
            'tempo_trabalho_dias', tempo_trabalho_dias
        ) ORDER BY data_inicio DESC
    ) INTO v_result
    FROM vw_engenheiros_projetos
    WHERE eng_id = p_eng_id AND ativo = true;
    
    RETURN COALESCE(v_result, '[]'::json);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCTION: listar_areas_disponiveis
-- Lista áreas para o chatbot sugerir
-- =====================================================

CREATE OR REPLACE FUNCTION listar_areas_disponiveis()
RETURNS JSON AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'codigo', codigo,
            'descricao', descricao,
            'tempo_dias', tempo_trabalho_dias
        ) ORDER BY descricao
    ) INTO v_result
    FROM areas
    WHERE ativo = true;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCTION: listar_status_disponiveis
-- Lista status para o chatbot sugerir
-- =====================================================

CREATE OR REPLACE FUNCTION listar_status_disponiveis()
RETURNS JSON AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'codigo', codigo,
            'descricao', descricao,
            'percentual', percentual_base
        ) ORDER BY ordem
    ) INTO v_result
    FROM status_codes
    WHERE ativo = true;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCTION: processar_prompt_chatbot
-- Function principal que recebe prompt e executa ação
-- =====================================================

CREATE OR REPLACE FUNCTION processar_prompt_chatbot(
    p_eng_id UUID,
    p_prompt TEXT,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSON AS $$
DECLARE
    v_log_id UUID;
    v_resultado JSON;
BEGIN
    -- Registra log inicial
    INSERT INTO chatbot_logs (eng_id, prompt_original, metadata)
    VALUES (p_eng_id, p_prompt, p_metadata)
    RETURNING log_id INTO v_log_id;
    
    -- Aqui o chatbot/LLM interpretará o prompt e chamará as functions apropriadas
    -- Por enquanto, retorna estrutura para o chatbot processar
    v_resultado := json_build_object(
        'log_id', v_log_id,
        'prompt_recebido', p_prompt,
        'funcoes_disponiveis', json_build_array(
            'cadastrar_engenheiro',
            'criar_projeto',
            'atribuir_area_projeto',
            'atualizar_status_projeto',
            'atualizar_previsao',
            'registrar_retrabalho',
            'buscar_meus_projetos'
        )
    );
    
    -- Atualiza log
    UPDATE chatbot_logs
    SET sucesso = true,
        mensagem_retorno = 'Prompt processado'
    WHERE log_id = v_log_id;
    
    RETURN v_resultado;
    
EXCEPTION WHEN OTHERS THEN
    UPDATE chatbot_logs
    SET sucesso = false,
        mensagem_retorno = SQLERRM
    WHERE log_id = v_log_id;
    
    RETURN json_build_object(
        'sucesso', false,
        'mensagem', 'Erro: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION processar_prompt_chatbot IS 'Function principal para processar prompts do chatbot';

-- =====================================================
-- NOVAS FUNCTIONS - PREVISÕES DIÁRIAS
-- =====================================================

-- =====================================================
-- FUNCTION: registrar_previsao_dia
-- Registra a previsão do que será feito no dia (início do dia)
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
BEGIN
    -- Valida atribuição
    IF NOT EXISTS (SELECT 1 FROM engenheiros_projetos WHERE id = p_atribuicao_id AND ativo = true) THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Atribuição não encontrada'
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
    
    -- Busca dados da atribuição
    SELECT projeto_id, eng_id, status_id
    INTO v_projeto_id, v_eng_id, v_status_id
    FROM engenheiros_projetos
    WHERE id = p_atribuicao_id;
    
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
        'data', CURRENT_DATE
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'sucesso', false,
        'mensagem', 'Erro ao registrar previsão: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION registrar_previsao_dia IS 'Registra previsão do dia (início do dia) - chatbot';

-- =====================================================
-- FUNCTION: atualizar_feito_dia
-- Atualiza o que foi feito ao fim do dia (torna imutável)
-- =====================================================

CREATE OR REPLACE FUNCTION atualizar_feito_dia(
    p_atribuicao_id UUID,
    p_feito_texto TEXT,
    p_nova_data_prevista DATE DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_previsao_id UUID;
BEGIN
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

COMMENT ON FUNCTION atualizar_feito_dia IS 'Registra o feito ao fim do dia - torna imutável - chatbot';

-- =====================================================
-- FUNCTION: registrar_retrabalho_dia
-- Registra se houve retrabalho no dia (boolean + motivo)
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
BEGIN
    -- Valida atribuição
    IF NOT EXISTS (SELECT 1 FROM engenheiros_projetos WHERE id = p_atribuicao_id AND ativo = true) THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Atribuição não encontrada'
        );
    END IF;
    
    -- Valida se já existe registro para hoje
    IF EXISTS (
        SELECT 1 FROM retrabalho_projetos 
        WHERE eng_projeto_id = p_atribuicao_id 
        AND data_retrabalho = CURRENT_DATE
    ) THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Já existe um registro de retrabalho para hoje'
        );
    END IF;
    
    -- Busca dados da atribuição
    SELECT projeto_id, eng_id, status_id
    INTO v_projeto_id, v_eng_id, v_status_id
    FROM engenheiros_projetos
    WHERE id = p_atribuicao_id;
    
    -- Insere retrabalho (trigger validará motivo obrigatório e atualizará status)
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
    ) RETURNING id INTO v_retrabalho_id;
    
    -- Busca quantidade total de retrabalhos
    SELECT quantidade_retrabalhos INTO v_quantidade
    FROM vw_quantidade_retrabalhos
    WHERE eng_projeto_id = p_atribuicao_id;
    
    RETURN json_build_object(
        'sucesso', true,
        'mensagem', CASE 
            WHEN p_necessitou_retrabalho THEN 
                'Retrabalho registrado. Total: ' || COALESCE(v_quantidade, 0) || ' retrabalhos.'
            ELSE 
                'Registrado: sem retrabalho hoje.'
        END,
        'retrabalho_id', v_retrabalho_id,
        'quantidade_total_retrabalhos', COALESCE(v_quantidade, 0)
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'sucesso', false,
        'mensagem', 'Erro ao registrar retrabalho: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION registrar_retrabalho_dia IS 'Registra retrabalho diário - contador automático - chatbot';

-- =====================================================
-- FUNCTION: criar_atualizar_prazos
-- Cria ou atualiza prazos do projeto
-- =====================================================

CREATE OR REPLACE FUNCTION criar_atualizar_prazos(
    p_atribuicao_id UUID,
    p_data_inicio_projeto DATE,
    p_prazo_final_eng DATE,
    p_prazo_final_cliente DATE,
    p_data_inicio_esperada_cliente DATE DEFAULT NULL,
    p_observacoes TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_prazo_id UUID;
    v_projeto_id UUID;
    v_eng_id UUID;
    v_existe BOOLEAN;
BEGIN
    -- Valida atribuição
    IF NOT EXISTS (SELECT 1 FROM engenheiros_projetos WHERE id = p_atribuicao_id AND ativo = true) THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Atribuição não encontrada'
        );
    END IF;
    
    -- Busca dados da atribuição
    SELECT projeto_id, eng_id INTO v_projeto_id, v_eng_id
    FROM engenheiros_projetos
    WHERE id = p_atribuicao_id;
    
    -- Verifica se já existe prazo
    SELECT EXISTS (
        SELECT 1 FROM prazos WHERE eng_projeto_id = p_atribuicao_id
    ) INTO v_existe;
    
    IF v_existe THEN
        -- Atualiza
        UPDATE prazos
        SET 
            data_inicio_projeto = p_data_inicio_projeto,
            data_inicio_esperada_cliente = p_data_inicio_esperada_cliente,
            prazo_final_eng = p_prazo_final_eng,
            prazo_final_cliente = p_prazo_final_cliente,
            observacoes = p_observacoes
        WHERE eng_projeto_id = p_atribuicao_id
        RETURNING id INTO v_prazo_id;
        
        RETURN json_build_object(
            'sucesso', true,
            'mensagem', 'Prazos atualizados com sucesso!',
            'prazo_id', v_prazo_id
        );
    ELSE
        -- Insere
        INSERT INTO prazos (
            eng_projeto_id,
            projeto_id,
            eng_id,
            data_inicio_projeto,
            data_inicio_esperada_cliente,
            prazo_final_eng,
            prazo_final_cliente,
            observacoes
        ) VALUES (
            p_atribuicao_id,
            v_projeto_id,
            v_eng_id,
            p_data_inicio_projeto,
            p_data_inicio_esperada_cliente,
            p_prazo_final_eng,
            p_prazo_final_cliente,
            p_observacoes
        ) RETURNING id INTO v_prazo_id;
        
        RETURN json_build_object(
            'sucesso', true,
            'mensagem', 'Prazos criados com sucesso!',
            'prazo_id', v_prazo_id
        );
    END IF;
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'sucesso', false,
        'mensagem', 'Erro ao criar/atualizar prazos: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION criar_atualizar_prazos IS 'Cria ou atualiza prazos do projeto - chatbot';

-- =====================================================
-- FUNCTION: buscar_historico_previsoes
-- Busca histórico de previsões (imutáveis)
-- =====================================================

CREATE OR REPLACE FUNCTION buscar_historico_previsoes(
    p_atribuicao_id UUID,
    p_limite INTEGER DEFAULT 30
)
RETURNS JSON AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'data', data_registro,
            'previsao', previsao_texto,
            'feito', feito_texto,
            'nova_data_prevista', nova_data_prevista,
            'tempo_estimado', tempo_estimado,
            'editavel', editavel
        ) ORDER BY data_registro DESC
    ) INTO v_result
    FROM projetos_previsao
    WHERE eng_projeto_id = p_atribuicao_id
    LIMIT p_limite;
    
    RETURN COALESCE(v_result, '[]'::json);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION buscar_historico_previsoes IS 'Busca histórico de previsões (últimos 30 dias) - chatbot';

-- =====================================================
-- FUNCTION: buscar_historico_retrabalhos
-- Busca histórico de retrabalhos com motivos
-- =====================================================

CREATE OR REPLACE FUNCTION buscar_historico_retrabalhos(
    p_atribuicao_id UUID
)
RETURNS JSON AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'data', data_retrabalho,
            'necessitou', necessitou_retrabalho,
            'motivo', motivo_retrabalho,
            'tipo', tipo_retrabalho,
            'descricao', descricao
        ) ORDER BY data_retrabalho DESC
    ) INTO v_result
    FROM retrabalho_projetos
    WHERE eng_projeto_id = p_atribuicao_id
    AND necessitou_retrabalho = true;
    
    RETURN COALESCE(v_result, '[]'::json);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION buscar_historico_retrabalhos IS 'Busca histórico de retrabalhos - chatbot';

-- Função para calcular os prazos
CREATE OR REPLACE FUNCTION calcular_prazos() 
RETURNS TRIGGER AS $$
BEGIN
    NEW.prazo_interno_dias := (NEW.prazo_final_eng - NEW.data_inicio_projeto);
    NEW.prazo_cliente_dias := (NEW.prazo_final_cliente - NEW.data_inicio_projeto);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar os prazos ao inserir ou atualizar
CREATE TRIGGER trg_calcular_prazos
BEFORE INSERT OR UPDATE ON prazos
FOR EACH ROW
EXECUTE FUNCTION calcular_prazos();

COMMENT ON TRIGGER trg_calcular_prazos ON prazos IS 'Calcula prazos internos e do cliente automaticamente ao inserir ou atualizar';

-- =====================================================
-- FUNCTION: verificar_atribuicao_info
-- Retorna info sobre atribuicao para validar exclusao
-- =====================================================
CREATE OR REPLACE FUNCTION verificar_atribuicao_info(
    p_atribuicao_id UUID
)
RETURNS JSON AS $$
DECLARE
    v_projeto_id UUID;
    v_codigo_projeto TEXT;
    v_area_descricao TEXT;
    v_eng_nome TEXT;
    v_total_disciplinas INTEGER := 0;
BEGIN
    SELECT
        ep.projeto_id,
        p.codigo_projeto,
        a.descricao,
        e.nome
    INTO
        v_projeto_id,
        v_codigo_projeto,
        v_area_descricao,
        v_eng_nome
    FROM engenheiros_projetos ep
    JOIN projetos p ON p.projeto_id = ep.projeto_id
    JOIN areas a ON a.area_id = ep.area_id
    LEFT JOIN engenheiros e ON e.eng_id = ep.eng_id
    WHERE ep.id = p_atribuicao_id
      AND ep.ativo = true
    LIMIT 1;

    IF v_projeto_id IS NULL THEN
        RETURN json_build_object(
            'ok', false,
            'codigo', 'nao_encontrada',
            'mensagem', 'Atribuicao nao encontrada ou ja excluida.'
        );
    END IF;

    SELECT COUNT(*) INTO v_total_disciplinas
    FROM engenheiros_projetos
    WHERE projeto_id = v_projeto_id
      AND ativo = true;

    RETURN json_build_object(
        'ok', true,
        'atribuicao_id', p_atribuicao_id,
        'projeto_id', v_projeto_id,
        'codigo_projeto', v_codigo_projeto,
        'area_descricao', v_area_descricao,
        'engenheiro_nome', v_eng_nome,
        'total_disciplinas_ativas', v_total_disciplinas,
        'is_ultima_disciplina', (v_total_disciplinas <= 1)
    );

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'ok', false,
        'codigo', 'erro_interno',
        'mensagem', 'Erro ao verificar atribuicao: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION verificar_atribuicao_info IS 'Retorna informacoes sobre uma atribuicao, incluindo se e a ultima disciplina ativa do projeto.';