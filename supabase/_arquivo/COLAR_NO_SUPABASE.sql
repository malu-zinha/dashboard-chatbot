-- =====================================================
-- 🔧 CORREÇÃO: dono_distribuir_tarefa
-- Cole este código no SQL Editor do Supabase
-- =====================================================

CREATE OR REPLACE FUNCTION dono_distribuir_tarefa(
    p_dono_id UUID,
    p_eng_id UUID,
    p_area_codigo TEXT,
    p_descricao_task TEXT,
    p_projeto_id UUID DEFAULT NULL,
    p_codigo_projeto TEXT DEFAULT NULL,
    p_cliente TEXT DEFAULT NULL,
    p_complexidade_codigo TEXT DEFAULT 'MEDIA',
    p_data_inicio_prevista DATE DEFAULT NULL,
    p_data_conclusao_prevista DATE DEFAULT NULL,
    p_observacoes_dono TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_task_id UUID;
    v_area_id UUID;  -- ✅ CORRIGIDO: ERA INTEGER, AGORA É UUID
    v_complexidade_id INTEGER;
    v_eng_nome TEXT;
    v_area_descricao TEXT;
BEGIN
    -- Valida dono
    IF NOT EXISTS (SELECT 1 FROM dono_empresa WHERE dono_id = p_dono_id AND ativo = true) THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Dono não encontrado ou inativo'
        );
    END IF;
    
    -- Valida engenheiro
    IF NOT EXISTS (SELECT 1 FROM engenheiros WHERE eng_id = p_eng_id AND ativo = true) THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Engenheiro não encontrado ou inativo'
        );
    END IF;
    
    -- Valida projeto ou código
    IF p_projeto_id IS NULL AND (p_codigo_projeto IS NULL OR p_cliente IS NULL) THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Informe projeto_id OU código_projeto + cliente'
        );
    END IF;
    
    -- Busca área
    SELECT area_id, descricao INTO v_area_id, v_area_descricao
    FROM areas
    WHERE UPPER(codigo) = UPPER(TRIM(p_area_codigo)) AND ativo = true;
    
    IF v_area_id IS NULL THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Área não encontrada: ' || p_area_codigo
        );
    END IF;
    
    -- Busca complexidade
    SELECT complexidade_id INTO v_complexidade_id
    FROM complexidade_tarefas
    WHERE UPPER(codigo) = UPPER(TRIM(p_complexidade_codigo)) AND ativo = true;
    
    IF v_complexidade_id IS NULL THEN
        -- Usa complexidade média como padrão
        SELECT complexidade_id INTO v_complexidade_id
        FROM complexidade_tarefas
        WHERE codigo = 'MEDIA';
    END IF;
    
    -- Busca nome do engenheiro
    SELECT nome INTO v_eng_nome
    FROM engenheiros
    WHERE eng_id = p_eng_id;
    
    -- Insere tarefa (trigger sincronizará automaticamente)
    INSERT INTO evandro_distribuicao_tasks (
        dono_id,
        eng_id,
        projeto_id,
        codigo_projeto,
        cliente,
        area_id,
        complexidade_id,
        descricao_task,
        data_inicio_prevista,
        data_conclusao_prevista,
        observacoes_dono,
        status_task
    ) VALUES (
        p_dono_id,
        p_eng_id,
        p_projeto_id,
        p_codigo_projeto,
        p_cliente,
        v_area_id,
        v_complexidade_id,
        p_descricao_task,
        p_data_inicio_prevista,
        p_data_conclusao_prevista,
        p_observacoes_dono,
        'PENDENTE'
    ) RETURNING task_id INTO v_task_id;
    
    RETURN json_build_object(
        'sucesso', true,
        'mensagem', format('✅ Tarefa distribuída para %s!', v_eng_nome),
        'task_id', v_task_id,
        'engenheiro', v_eng_nome,
        'area', v_area_descricao,
        'detalhes', json_build_object(
            'sincronizado', true,
            'notificacao_whatsapp', 'Será enviada automaticamente',
            'status', 'PENDENTE'
        )
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'sucesso', false,
        'mensagem', 'Erro ao distribuir tarefa: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION dono_distribuir_tarefa IS 'Distribui tarefa para engenheiro - sincroniza e notifica automaticamente';

