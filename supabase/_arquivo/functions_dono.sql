-- =====================================================
-- FUNCTIONS PARA O DONO DA EMPRESA
-- Distribuição de tarefas e consultas gerenciais
-- =====================================================

-- =====================================================
-- FUNCTION: dono_distribuir_tarefa
-- Distribui nova tarefa para um engenheiro
-- Sincroniza automaticamente e envia notificação WhatsApp
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
    v_area_id UUID;
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

-- =====================================================
-- FUNCTION: dono_distribuir_projeto_com_prazos
-- Distribui projeto existente para engenheiro com cadastro completo de prazos
-- =====================================================

CREATE OR REPLACE FUNCTION dono_distribuir_projeto_com_prazos(
    p_dono_id UUID,
    p_eng_id UUID,
    p_projeto_id UUID,
    p_area_codigo TEXT,
    p_data_inicio DATE,
    p_prazo_final_eng DATE,
    p_prazo_final_cliente DATE,
    p_data_inicio_esperada_cliente DATE DEFAULT NULL,
    p_observacoes TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_area_id UUID;
    v_status_id INTEGER;
    v_eng_projeto_id UUID;
    v_prazo_id UUID;
    v_eng_nome TEXT;
    v_area_descricao TEXT;
    v_codigo_projeto TEXT;
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
    
    -- Valida projeto
    IF NOT EXISTS (SELECT 1 FROM projetos WHERE projeto_id = p_projeto_id AND ativo = true) THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Projeto não encontrado ou inativo'
        );
    END IF;
    
    -- Valida datas
    IF p_prazo_final_eng < p_data_inicio THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Prazo final do engenheiro deve ser maior ou igual à data de início'
        );
    END IF;
    
    IF p_prazo_final_cliente < p_prazo_final_eng THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Prazo final do cliente deve ser maior ou igual ao prazo interno'
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
    
    -- Busca dados complementares
    SELECT nome INTO v_eng_nome FROM engenheiros WHERE eng_id = p_eng_id;
    SELECT codigo_projeto INTO v_codigo_projeto FROM projetos WHERE projeto_id = p_projeto_id;
    
    -- Busca status inicial
    SELECT status_id INTO v_status_id
    FROM status_codes
    WHERE codigo = 'AGUARDANDO_INICIO'
    LIMIT 1;
    
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
    
    -- 1. Cria atribuição em engenheiros_projetos
    INSERT INTO engenheiros_projetos (
        eng_id,
        projeto_id,
        area_id,
        data_inicio,
        data_prevista,
        status_id,
        observacoes
    ) VALUES (
        p_eng_id,
        p_projeto_id,
        v_area_id,
        p_data_inicio,
        p_prazo_final_eng,
        v_status_id,
        p_observacoes
    ) RETURNING id INTO v_eng_projeto_id;
    
    -- 2. Cria registro de prazos (triggers calcularão prazo_interno_dias e prazo_cliente_dias)
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
        v_eng_projeto_id,
        p_projeto_id,
        p_eng_id,
        p_data_inicio,
        p_data_inicio_esperada_cliente,
        p_prazo_final_eng,
        p_prazo_final_cliente,
        p_observacoes
    ) RETURNING id INTO v_prazo_id;
    
    -- 3. Registra em evandro_distribuicao_tasks
    INSERT INTO evandro_distribuicao_tasks (
        dono_id,
        eng_id,
        projeto_id,
        area_id,
        eng_projeto_id,
        descricao_task,
        data_inicio_prevista,
        data_conclusao_prevista,
        observacoes_dono,
        status_task,
        sincronizado,
        data_sincronizacao
    ) VALUES (
        p_dono_id,
        p_eng_id,
        p_projeto_id,
        v_area_id,
        v_eng_projeto_id,
        'Projeto distribuído com prazos definidos',
        p_data_inicio,
        p_prazo_final_cliente,
        p_observacoes,
        'CONCLUIDO', -- Já está sincronizado
        true,
        NOW()
    );
    
    -- 4. Notificação WhatsApp é criada automaticamente pelo trigger
    -- trg_notificar_novo_projeto (AFTER INSERT em engenheiros_projetos)

    RETURN json_build_object(
        'sucesso', true,
        'mensagem', format('✅ Projeto distribuído para %s com prazos cadastrados!', v_eng_nome),
        'eng_projeto_id', v_eng_projeto_id,
        'prazo_id', v_prazo_id,
        'detalhes', json_build_object(
            'engenheiro', v_eng_nome,
            'projeto', v_codigo_projeto,
            'area', v_area_descricao,
            'data_inicio', p_data_inicio,
            'prazo_eng', p_prazo_final_eng,
            'prazo_cliente', p_prazo_final_cliente
        )
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'sucesso', false,
        'mensagem', 'Erro ao distribuir projeto: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION dono_distribuir_projeto_com_prazos IS 'Distribui projeto existente com cadastro completo de prazos na tabela prazos';

-- =====================================================
-- FUNCTION: dono_consultar_status_engenheiro
-- Consulta status de um engenheiro específico
-- =====================================================

CREATE OR REPLACE FUNCTION dono_consultar_status_engenheiro(
    p_dono_id UUID,
    p_eng_id UUID
)
RETURNS JSON AS $$
DECLARE
    v_result JSON;
BEGIN
    -- Valida dono
    IF NOT EXISTS (SELECT 1 FROM dono_empresa WHERE dono_id = p_dono_id AND ativo = true) THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Dono não encontrado'
        );
    END IF;
    
    -- Busca detalhes do engenheiro
    SELECT json_build_object(
        'eng_id', eng_id,
        'nome', engenheiro_nome,
        'exclusivo', exclusivo,
        'total_projetos', total_projetos,
        'total_areas', total_areas,
        'media_percentual', media_percentual,
        'areas_ativas', areas_ativas,
        'total_retrabalhos', total_retrabalhos,
        'complexidade_media', complexidade_media,
        'dias_trabalho_pendentes', dias_trabalho_pendentes,
        'areas_atrasadas', areas_atrasadas,
        'projetos', (
            SELECT json_agg(
                json_build_object(
                    'projeto', codigo_projeto,
                    'cliente', cliente,
                    'area', area_descricao,
                    'status', status_descricao,
                    'taxa_execucao', taxa_execucao,
                    'complexidade', complexidade_descricao,
                    'retrabalhos', quantidade_retrabalhos,
                    'dias_atraso', dias_atraso,
                    'prazo_final', prazo_final_eng
                ) ORDER BY taxa_execucao ASC
            )
            FROM vw_dono_engenheiro_detalhado
            WHERE eng_id = p_eng_id
        )
    ) INTO v_result
    FROM vw_dono_visao_geral
    WHERE eng_id = p_eng_id;
    
    IF v_result IS NULL THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Engenheiro não encontrado'
        );
    END IF;
    
    RETURN json_build_object(
        'sucesso', true,
        'dados', v_result
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'sucesso', false,
        'mensagem', 'Erro ao consultar: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION dono_consultar_status_engenheiro IS 'Consulta status completo de um engenheiro';

-- =====================================================
-- FUNCTION: dono_consultar_todos_engenheiros
-- Consulta visão geral de todos os engenheiros
-- =====================================================

CREATE OR REPLACE FUNCTION dono_consultar_todos_engenheiros(
    p_dono_id UUID
)
RETURNS JSON AS $$
DECLARE
    v_result JSON;
BEGIN
    -- Valida dono
    IF NOT EXISTS (SELECT 1 FROM dono_empresa WHERE dono_id = p_dono_id AND ativo = true) THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Dono não encontrado'
        );
    END IF;
    
    SELECT json_agg(
        json_build_object(
            'eng_id', eng_id,
            'nome', engenheiro_nome,
            'exclusivo', exclusivo,
            'total_projetos', total_projetos,
            'areas_ativas', areas_ativas,
            'media_percentual', media_percentual,
            'total_retrabalhos', total_retrabalhos,
            'complexidade_media', complexidade_media,
            'dias_trabalho_pendentes', dias_trabalho_pendentes,
            'areas_atrasadas', areas_atrasadas,
            'status_carga', CASE
                WHEN dias_trabalho_pendentes > 30 THEN 'SOBRECARREGADO'
                WHEN dias_trabalho_pendentes > 15 THEN 'CARGA_ALTA'
                WHEN dias_trabalho_pendentes > 7 THEN 'CARGA_MEDIA'
                ELSE 'DISPONIVEL'
            END
        ) ORDER BY dias_trabalho_pendentes ASC
    ) INTO v_result
    FROM vw_dono_visao_geral;
    
    RETURN json_build_object(
        'sucesso', true,
        'total_engenheiros', (SELECT COUNT(*) FROM vw_dono_visao_geral),
        'engenheiros', v_result
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'sucesso', false,
        'mensagem', 'Erro ao consultar: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION dono_consultar_todos_engenheiros IS 'Lista todos os engenheiros com status de carga';

-- =====================================================
-- FUNCTION: dono_buscar_historico_retrabalhos
-- Busca histórico completo de retrabalhos (para gráficos)
-- =====================================================

CREATE OR REPLACE FUNCTION dono_buscar_historico_retrabalhos(
    p_dono_id UUID,
    p_eng_id UUID DEFAULT NULL,
    p_projeto_id UUID DEFAULT NULL,
    p_data_inicio DATE DEFAULT NULL,
    p_data_fim DATE DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_result JSON;
    v_query TEXT;
BEGIN
    -- Valida dono
    IF NOT EXISTS (SELECT 1 FROM dono_empresa WHERE dono_id = p_dono_id AND ativo = true) THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Dono não encontrado'
        );
    END IF;
    
    -- Busca histórico
    SELECT json_build_object(
        'total_retrabalhos', COUNT(*),
        'engenheiros_afetados', COUNT(DISTINCT eng_id),
        'projetos_afetados', COUNT(DISTINCT projeto_id),
        'historico', json_agg(
            json_build_object(
                'data', data_retrabalho,
                'engenheiro', engenheiro_nome,
                'projeto', codigo_projeto,
                'area', area_descricao,
                'motivo', motivo_retrabalho,
                'tipo', tipo_retrabalho,
                'status', status_na_epoca
            ) ORDER BY data_retrabalho DESC
        ),
        'por_motivo', (
            SELECT json_agg(
                json_build_object(
                    'motivo', motivo_retrabalho,
                    'quantidade', quantidade
                ) ORDER BY quantidade DESC
            )
            FROM vw_dono_retrabalhos_por_motivo
        )
    ) INTO v_result
    FROM vw_dono_retrabalhos_historico
    WHERE 
        (p_eng_id IS NULL OR eng_id = p_eng_id)
        AND (p_projeto_id IS NULL OR projeto_id = p_projeto_id)
        AND (p_data_inicio IS NULL OR data_retrabalho >= p_data_inicio)
        AND (p_data_fim IS NULL OR data_retrabalho <= p_data_fim);
    
    RETURN json_build_object(
        'sucesso', true,
        'filtros', json_build_object(
            'eng_id', p_eng_id,
            'projeto_id', p_projeto_id,
            'periodo', CASE 
                WHEN p_data_inicio IS NOT NULL OR p_data_fim IS NOT NULL 
                THEN json_build_object('inicio', p_data_inicio, 'fim', p_data_fim)
                ELSE 'todos'
            END
        ),
        'dados', v_result
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'sucesso', false,
        'mensagem', 'Erro ao buscar retrabalhos: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION dono_buscar_historico_retrabalhos IS 'Busca histórico de retrabalhos com filtros - para gráficos';

-- =====================================================
-- FUNCTION: dono_recomendar_engenheiro
-- Recomenda melhor engenheiro para uma tarefa baseado em:
-- - Carga de trabalho atual
-- - Taxa de execução
-- - Exclusividade
-- - Retrabalhos
-- =====================================================

CREATE OR REPLACE FUNCTION dono_recomendar_engenheiro(
    p_dono_id UUID,
    p_complexidade_desejada INTEGER DEFAULT 3 -- 1 a 5
)
RETURNS JSON AS $$
DECLARE
    v_result JSON;
BEGIN
    -- Valida dono
    IF NOT EXISTS (SELECT 1 FROM dono_empresa WHERE dono_id = p_dono_id AND ativo = true) THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Dono não encontrado'
        );
    END IF;
    
    -- Calcula score e recomenda
    SELECT json_agg(
        json_build_object(
            'eng_id', vg.eng_id,
            'nome', vg.engenheiro_nome,
            'exclusivo', vg.exclusivo,
            'score', score,
            'motivo', motivo,
            'carga_atual', vg.dias_trabalho_pendentes || ' dias',
            'taxa_execucao', vr.taxa_execucao_media || '%',
            'total_retrabalhos', vg.total_retrabalhos,
            'areas_atrasadas', vg.areas_atrasadas,
            'status_carga', CASE
                WHEN vg.dias_trabalho_pendentes > 30 THEN 'SOBRECARREGADO'
                WHEN vg.dias_trabalho_pendentes > 15 THEN 'CARGA_ALTA'
                WHEN vg.dias_trabalho_pendentes > 7 THEN 'CARGA_MEDIA'
                ELSE 'DISPONIVEL'
            END
        ) ORDER BY score DESC
    ) INTO v_result
    FROM (
        SELECT 
            vg.eng_id,
            vg.engenheiro_nome,
            vg.exclusivo,
            vg.dias_trabalho_pendentes,
            vg.total_retrabalhos,
            vg.areas_atrasadas,
            -- Score: quanto maior, melhor
            (
                -- Baixa carga de trabalho (+pontos)
                (50 - COALESCE(vg.dias_trabalho_pendentes, 0)) +
                
                -- Alta taxa de execução (+pontos)
                (vr.taxa_execucao_media * 0.5) +
                
                -- Poucos retrabalhos (+pontos)
                (20 - COALESCE(vg.total_retrabalhos, 0)) +
                
                -- Sem atrasos (+pontos)
                (CASE WHEN vg.areas_atrasadas = 0 THEN 20 ELSE 0 END) +
                
                -- Exclusivo (+pontos)
                (CASE WHEN vg.exclusivo = true THEN 10 ELSE 0 END)
            ) AS score,
            
            -- Motivo da recomendação
            CASE 
                WHEN COALESCE(vg.dias_trabalho_pendentes, 0) <= 7 THEN 'Baixa carga de trabalho'
                WHEN vr.taxa_execucao_media >= 70 THEN 'Alta taxa de execução'
                WHEN vg.exclusivo = true THEN 'Engenheiro exclusivo'
                ELSE 'Disponível'
            END AS motivo
            
        FROM vw_dono_visao_geral vg
        LEFT JOIN vw_dono_taxa_execucao_ranking vr ON vr.eng_id = vg.eng_id
    ) AS ranked
    JOIN vw_dono_visao_geral vg ON vg.eng_id = ranked.eng_id
    JOIN vw_dono_taxa_execucao_ranking vr ON vr.eng_id = ranked.eng_id
    LIMIT 5;
    
    RETURN json_build_object(
        'sucesso', true,
        'mensagem', 'Top 5 engenheiros recomendados',
        'complexidade_tarefa', p_complexidade_desejada,
        'recomendacoes', v_result
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'sucesso', false,
        'mensagem', 'Erro ao recomendar: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION dono_recomendar_engenheiro IS 'Recomenda melhor engenheiro baseado em carga, execução e retrabalhos';

-- =====================================================
-- FUNCTION: processar_fila_notificacoes
-- Processa fila de notificações WhatsApp (chamada externamente)
-- =====================================================

CREATE OR REPLACE FUNCTION processar_fila_notificacoes()
RETURNS JSON AS $$
DECLARE
    v_notificacoes JSON;
    v_count INTEGER;
BEGIN
    -- Busca notificações pendentes
    SELECT 
        json_agg(
            json_build_object(
                'notificacao_id', notificacao_id,
                'eng_id', eng_id,
                'telefone', telefone,
                'tipo', tipo,
                'titulo', titulo,
                'mensagem', mensagem,
                'task_id', task_id,
                'projeto_id', projeto_id
            )
        ),
        COUNT(*)
    INTO v_notificacoes, v_count
    FROM notificacoes_whatsapp
    WHERE enviada = false
    AND tentativas < 3
    ORDER BY created_at ASC
    LIMIT 50;
    
    RETURN json_build_object(
        'sucesso', true,
        'pendentes', v_count,
        'notificacoes', COALESCE(v_notificacoes, '[]'::json)
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'sucesso', false,
        'mensagem', 'Erro ao processar fila: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION processar_fila_notificacoes IS 'Retorna notificações pendentes para envio via WhatsApp';

-- =====================================================
-- FUNCTION: marcar_notificacao_enviada
-- Marca notificação como enviada
-- =====================================================

CREATE OR REPLACE FUNCTION marcar_notificacao_enviada(
    p_notificacao_id UUID,
    p_sucesso BOOLEAN DEFAULT true,
    p_erro TEXT DEFAULT NULL
)
RETURNS JSON AS $$
BEGIN
    IF p_sucesso THEN
        UPDATE notificacoes_whatsapp
        SET 
            enviada = true,
            data_envio = NOW()
        WHERE notificacao_id = p_notificacao_id;
        
        -- Atualiza flag na task
        UPDATE evandro_distribuicao_tasks
        SET 
            notificacao_enviada = true,
            data_notificacao = NOW()
        WHERE task_id = (
            SELECT task_id FROM notificacoes_whatsapp 
            WHERE notificacao_id = p_notificacao_id
        );
    ELSE
        UPDATE notificacoes_whatsapp
        SET 
            tentativas = tentativas + 1,
            erro_envio = p_erro
        WHERE notificacao_id = p_notificacao_id;
    END IF;
    
    RETURN json_build_object(
        'sucesso', true,
        'mensagem', CASE WHEN p_sucesso THEN 'Notificação enviada' ELSE 'Erro registrado' END
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'sucesso', false,
        'mensagem', 'Erro: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION marcar_notificacao_enviada IS 'Marca notificação como enviada ou registra erro';




