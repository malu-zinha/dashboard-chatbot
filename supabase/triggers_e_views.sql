-- =====================================================
-- TRIGGERS E VIEWS - COMPLEMENTO DO MASTER_SCHEMA
-- =====================================================
-- Execute APÓS: 
-- 1. MASTER_SCHEMA_COMPLETO.sql
-- 2. adicionar_telefone_auth.sql
-- 3. chatbot_functions.sql
-- =====================================================

-- =====================================================
-- FUNCTION: update_updated_at_column
-- Atualiza coluna updated_at automaticamente
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_updated_at_column IS 'Atualiza automaticamente a coluna updated_at';

-- =====================================================
-- TRIGGERS: Atualizar updated_at
-- =====================================================

CREATE TRIGGER trg_engenheiros_updated_at
    BEFORE UPDATE ON engenheiros
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_projetos_updated_at
    BEFORE UPDATE ON projetos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_eng_proj_updated_at
    BEFORE UPDATE ON engenheiros_projetos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- FUNCTION: calcular_tempo_trabalho
-- Calcula tempo_trabalho_dias automaticamente baseado na área
-- =====================================================

CREATE OR REPLACE FUNCTION calcular_tempo_trabalho()
RETURNS TRIGGER AS $$
BEGIN
    -- Busca o tempo de trabalho da área e atribui automaticamente
    SELECT tempo_trabalho_dias INTO NEW.tempo_trabalho_dias
    FROM areas
    WHERE area_id = NEW.area_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calcular_tempo_trabalho IS 'Calcula tempo_trabalho_dias automaticamente baseado na área';

-- Trigger para calcular tempo_trabalho ao inserir/atualizar
CREATE TRIGGER trg_calcular_tempo_trabalho
    BEFORE INSERT OR UPDATE OF area_id ON engenheiros_projetos
    FOR EACH ROW
    EXECUTE FUNCTION calcular_tempo_trabalho();

-- =====================================================
-- FUNCTION: calcular_percentual_status
-- Calcula percentual_andamento automaticamente baseado no status
-- =====================================================

CREATE OR REPLACE FUNCTION calcular_percentual_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Se o status mudou, atualiza o percentual baseado no status
    IF NEW.status_id IS NOT NULL THEN
        SELECT percentual_base INTO NEW.percentual_andamento
        FROM status_codes
        WHERE status_id = NEW.status_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calcular_percentual_status IS 'Calcula percentual_andamento automaticamente baseado no status';

-- Trigger para calcular percentual ao atualizar status
CREATE TRIGGER trg_calcular_percentual_status
    BEFORE INSERT OR UPDATE OF status_id ON engenheiros_projetos
    FOR EACH ROW
    EXECUTE FUNCTION calcular_percentual_status();

-- =====================================================
-- FUNCTION: validar_edicao_previsao
-- Torna previsões imutáveis após fim do dia
-- =====================================================

CREATE OR REPLACE FUNCTION validar_edicao_previsao()
RETURNS TRIGGER AS $$
BEGIN
    -- Se já existe e não é mais editável, bloqueia atualização
    IF TG_OP = 'UPDATE' AND OLD.editavel = false THEN
        RAISE EXCEPTION 'Registro não pode ser editado após o fim do dia';
    END IF;
    
    -- Se está marcando como fim do dia, torna imutável
    IF NEW.feito_texto IS NOT NULL AND NEW.editavel = true THEN
        NEW.editavel := false;
        NEW.data_fim_dia := NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION validar_edicao_previsao IS 'Torna previsões imutáveis após preenchimento do feito_texto';

CREATE TRIGGER trg_validar_edicao_previsao
    BEFORE UPDATE ON projetos_previsao
    FOR EACH ROW
    EXECUTE FUNCTION validar_edicao_previsao();

-- =====================================================
-- FUNCTION: validar_motivo_retrabalho
-- Valida motivo obrigatório em retrabalhos
-- =====================================================

CREATE OR REPLACE FUNCTION validar_motivo_retrabalho()
RETURNS TRIGGER AS $$
BEGIN
    -- Se necessitou retrabalho = true, motivo é obrigatório
    IF NEW.necessitou_retrabalho = true THEN
        IF NEW.motivo_retrabalho IS NULL OR TRIM(NEW.motivo_retrabalho) = '' THEN
            RAISE EXCEPTION 'Motivo do retrabalho é obrigatório quando necessitou_retrabalho = TRUE';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION validar_motivo_retrabalho IS 'Valida que motivo é obrigatório quando há retrabalho';

CREATE TRIGGER trg_validar_motivo_retrabalho
    BEFORE INSERT OR UPDATE ON retrabalho_projetos
    FOR EACH ROW
    EXECUTE FUNCTION validar_motivo_retrabalho();

-- =====================================================
-- FUNCTION: atualizar_status_retrabalho
-- Adiciona 1 dia de atraso quando há retrabalho
-- =====================================================

CREATE OR REPLACE FUNCTION atualizar_status_retrabalho()
RETURNS TRIGGER AS $$
BEGIN
    -- Se houve retrabalho, registra o status atual
    IF NEW.necessitou_retrabalho = true THEN
        -- Busca o status atual da atribuição
        SELECT status_id INTO NEW.status_id
        FROM engenheiros_projetos
        WHERE id = NEW.eng_projeto_id;
        
        -- Atualiza a data prevista na atribuição (adiciona 1 dia de atraso)
        UPDATE engenheiros_projetos
        SET data_prevista = data_prevista + INTERVAL '1 day'
        WHERE id = NEW.eng_projeto_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION atualizar_status_retrabalho IS 'Atualiza status e adiciona atraso quando há retrabalho';

CREATE TRIGGER trg_atualizar_status_retrabalho
    BEFORE INSERT ON retrabalho_projetos
    FOR EACH ROW
    EXECUTE FUNCTION atualizar_status_retrabalho();

-- =====================================================
-- FUNCTION: preencher_variaveis_compartilhadas
-- Preenche projeto_id e eng_id automaticamente
-- =====================================================

CREATE OR REPLACE FUNCTION preencher_variaveis_compartilhadas()
RETURNS TRIGGER AS $$
BEGIN
    -- Para projetos_previsao, retrabalho_projetos e prazos
    -- Busca projeto_id e eng_id da atribuição
    IF NEW.eng_projeto_id IS NOT NULL THEN
        SELECT projeto_id, eng_id 
        INTO NEW.projeto_id, NEW.eng_id
        FROM engenheiros_projetos
        WHERE id = NEW.eng_projeto_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION preencher_variaveis_compartilhadas IS 'Preenche automaticamente projeto_id e eng_id das tabelas relacionadas';

-- Triggers para preencher variáveis compartilhadas
CREATE TRIGGER trg_preencher_vars_previsao
    BEFORE INSERT ON projetos_previsao
    FOR EACH ROW
    EXECUTE FUNCTION preencher_variaveis_compartilhadas();

CREATE TRIGGER trg_preencher_vars_retrabalho
    BEFORE INSERT ON retrabalho_projetos
    FOR EACH ROW
    EXECUTE FUNCTION preencher_variaveis_compartilhadas();

CREATE TRIGGER trg_preencher_vars_prazos
    BEFORE INSERT ON prazos
    FOR EACH ROW
    EXECUTE FUNCTION preencher_variaveis_compartilhadas();

-- =====================================================
-- FUNCTION: sincronizar_task_para_engenheiro
-- Sincroniza distribuição de tarefas do dono
-- =====================================================

-- ATENCAO: esta definicao esta DESATUALIZADA e nao deve sobrescrever a de
-- supabase/migrations/20261004_observacoes_e_feito_do_dia.sql, que e a vigente.
-- Alem do carimbo de atribuicao (que agora vai para a coluna atribuido_por, nao
-- para observacoes), a versao abaixo tambem nao conhece instancia_label nem
-- complemento_area_ref_id. Aplicar este arquivo depois das migrations reverte
-- as duas coisas. Mantido so como historico.
CREATE OR REPLACE FUNCTION sincronizar_task_para_engenheiro()
RETURNS TRIGGER AS $$
DECLARE
    v_projeto_id UUID;
    v_eng_projeto_id UUID;
    v_status_id INTEGER;
    v_telefone TEXT;
BEGIN
    -- Só sincroniza se ainda não foi sincronizado
    IF NEW.sincronizado = false THEN
        
        -- 1. Criar projeto se não existir
        IF NEW.projeto_id IS NULL AND NEW.codigo_projeto IS NOT NULL THEN
            INSERT INTO projetos (codigo_projeto, cliente)
            VALUES (NEW.codigo_projeto, NEW.cliente)
            RETURNING projeto_id INTO v_projeto_id;
            
            NEW.projeto_id := v_projeto_id;
        ELSE
            v_projeto_id := NEW.projeto_id;
        END IF;
        
        -- 2. Busca status inicial
        SELECT status_id INTO v_status_id
        FROM status_codes
        WHERE codigo = 'AGUARDANDO_INICIO'
        LIMIT 1;
        
        -- 3. Criar atribuição em engenheiros_projetos
        INSERT INTO engenheiros_projetos (
            eng_id,
            projeto_id,
            area_id,
            data_inicio,
            data_prevista,
            status_id,
            atribuido_por
        ) VALUES (
            NEW.eng_id,
            v_projeto_id,
            NEW.area_id,
            COALESCE(NEW.data_inicio_prevista, CURRENT_DATE),
            NEW.data_conclusao_prevista,
            v_status_id,
            'Atribuído por: ' || COALESCE(
                (SELECT nome FROM dono_empresa WHERE dono_id = NEW.dono_id),
                'Sistema'
            )
        ) RETURNING id INTO v_eng_projeto_id;
        
        -- 4. Atualiza a task com referência
        NEW.eng_projeto_id := v_eng_projeto_id;
        NEW.sincronizado := true;
        NEW.data_sincronizacao := NOW();
        
        -- 5. Busca telefone do engenheiro
        SELECT telefone INTO v_telefone
        FROM engenheiros
        WHERE eng_id = NEW.eng_id;
        
        -- 6. Cria notificação para WhatsApp
        INSERT INTO notificacoes_whatsapp (
            eng_id,
            telefone,
            tipo,
            titulo,
            mensagem,
            task_id,
            projeto_id
        ) VALUES (
            NEW.eng_id,
            v_telefone,
            'NOVA_TAREFA',
            '🆕 Nova Tarefa Atribuída!',
            '📋 Projeto: ' || COALESCE(NEW.codigo_projeto, 
                (SELECT codigo_projeto FROM projetos WHERE projeto_id = v_projeto_id)) || 
            E'\n📦 Área: ' || (SELECT descricao FROM areas WHERE area_id = NEW.area_id) ||
            E'\n📝 Descrição: ' || NEW.descricao_task ||
            E'\n📅 Início previsto: ' || COALESCE(NEW.data_inicio_prevista::TEXT, 'Não definido') ||
            E'\n⏰ Conclusão prevista: ' || COALESCE(NEW.data_conclusao_prevista::TEXT, 'Não definido'),
            NEW.task_id,
            v_projeto_id
        );
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION sincronizar_task_para_engenheiro IS 'Sincroniza automaticamente tasks com engenheiros_projetos e cria notificação';

CREATE TRIGGER trg_sincronizar_task
    BEFORE INSERT OR UPDATE ON evandro_distribuicao_tasks
    FOR EACH ROW
    EXECUTE FUNCTION sincronizar_task_para_engenheiro();

-- =====================================================
-- VIEW: vw_quantidade_retrabalhos
-- Contador de retrabalhos por atribuição
-- =====================================================

CREATE OR REPLACE VIEW vw_quantidade_retrabalhos AS
SELECT 
    eng_projeto_id,
    COUNT(*) FILTER (WHERE necessitou_retrabalho = true) AS quantidade_retrabalhos,
    COUNT(*) AS total_dias_registrados,
    ROUND(
        (COUNT(*) FILTER (WHERE necessitou_retrabalho = true)::NUMERIC / 
         NULLIF(COUNT(*), 0)::NUMERIC) * 100, 
        2
    ) AS percentual_retrabalhos
FROM retrabalho_projetos
GROUP BY eng_projeto_id;

COMMENT ON VIEW vw_quantidade_retrabalhos IS 'Contador de retrabalhos por atribuição de projeto';

-- =====================================================
-- VIEW: vw_engenheiros_projetos
-- Visão consolidada de engenheiros, projetos e áreas
-- =====================================================

CREATE OR REPLACE VIEW vw_engenheiros_projetos AS
SELECT 
    e.eng_id,
    e.nome AS engenheiro_nome,
    e.exclusivo,
    p.projeto_id,
    p.codigo_projeto,
    p.cliente,
    a.area_id,
    a.codigo AS area_codigo,
    a.descricao AS area_descricao,
    ep.id AS atribuicao_id,
    ep.data_inicio,
    ep.data_prevista,
    ep.data_conclusao,
    s.status_id,
    s.codigo AS status_codigo,
    s.descricao AS status_descricao,
    ep.percentual_andamento,
    ep.tempo_trabalho_dias,
    ep.observacoes,
    ep.ativo,
    ep.created_at,
    ep.updated_at
FROM engenheiros_projetos ep
JOIN engenheiros e ON e.eng_id = ep.eng_id
JOIN projetos p ON p.projeto_id = ep.projeto_id
JOIN areas a ON a.area_id = ep.area_id
LEFT JOIN status_codes s ON s.status_id = ep.status_id
WHERE ep.ativo = true AND e.ativo = true AND p.ativo = true;

COMMENT ON VIEW vw_engenheiros_projetos IS 'Visão consolidada de engenheiros, projetos e áreas';

-- =====================================================
-- VIEW: vw_resumo_engenheiros
-- Resumo estatístico por engenheiro
-- =====================================================

CREATE OR REPLACE VIEW vw_resumo_engenheiros AS
SELECT 
    e.eng_id,
    e.nome,
    e.exclusivo,
    COUNT(DISTINCT ep.projeto_id) AS total_projetos,
    COUNT(ep.id) AS total_atribuicoes,
    AVG(ep.percentual_andamento) AS media_percentual,
    SUM(CASE WHEN ep.data_conclusao IS NULL AND ep.ativo = true THEN 1 ELSE 0 END) AS projetos_ativos
FROM engenheiros e
LEFT JOIN engenheiros_projetos ep ON ep.eng_id = e.eng_id AND ep.ativo = true
WHERE e.ativo = true
GROUP BY e.eng_id, e.nome, e.exclusivo;

COMMENT ON VIEW vw_resumo_engenheiros IS 'Resumo estatístico por engenheiro';

-- =====================================================
-- VIEW: vw_projetos_completo
-- Visão completa com retrabalhos e prazos
-- =====================================================

CREATE OR REPLACE VIEW vw_projetos_completo AS
SELECT 
    ep.id AS atribuicao_id,
    e.eng_id,
    e.nome AS engenheiro_nome,
    p.projeto_id,
    p.codigo_projeto,
    p.cliente,
    a.area_id,
    a.codigo AS area_codigo,
    a.descricao AS area_descricao,
    ep.data_inicio,
    ep.data_prevista,
    ep.data_conclusao,
    s.status_id,
    s.descricao AS status_descricao,
    ep.percentual_andamento,
    ep.tempo_trabalho_dias,
    
    -- Prazos
    pr.data_inicio_projeto,
    pr.data_inicio_esperada_cliente,
    pr.prazo_final_eng,
    pr.prazo_final_cliente,
    pr.prazo_interno_dias,
    pr.prazo_cliente_dias,
    
    -- Retrabalhos
    COALESCE(vr.quantidade_retrabalhos, 0) AS quantidade_retrabalhos,
    COALESCE(vr.percentual_retrabalhos, 0) AS percentual_retrabalhos,
    
    -- Última previsão
    (SELECT previsao_texto FROM projetos_previsao 
     WHERE eng_projeto_id = ep.id 
     ORDER BY data_registro DESC LIMIT 1) AS ultima_previsao,
    
    (SELECT feito_texto FROM projetos_previsao 
     WHERE eng_projeto_id = ep.id 
     ORDER BY data_registro DESC LIMIT 1) AS ultimo_feito,
    
    -- Cálculo de dias de atraso
    CASE 
        WHEN ep.data_prevista < CURRENT_DATE AND ep.data_conclusao IS NULL 
        THEN (CURRENT_DATE - ep.data_prevista)::INTEGER
        ELSE 0
    END AS dias_atraso
    
FROM engenheiros_projetos ep
JOIN engenheiros e ON e.eng_id = ep.eng_id
JOIN projetos p ON p.projeto_id = ep.projeto_id
JOIN areas a ON a.area_id = ep.area_id
LEFT JOIN status_codes s ON s.status_id = ep.status_id
LEFT JOIN prazos pr ON pr.eng_projeto_id = ep.id
LEFT JOIN vw_quantidade_retrabalhos vr ON vr.eng_projeto_id = ep.id
WHERE ep.ativo = true;

COMMENT ON VIEW vw_projetos_completo IS 'Visão consolidada com retrabalhos, prazos e previsões';

-- =====================================================
-- VIEW: vw_dono_visao_geral
-- Visão consolidada do dono (todos os engenheiros)
-- =====================================================

CREATE OR REPLACE VIEW vw_dono_visao_geral AS
SELECT 
    e.eng_id,
    e.nome AS engenheiro_nome,
    e.exclusivo,
    
    -- Estatísticas gerais
    COUNT(DISTINCT ep.projeto_id) AS total_projetos,
    COUNT(DISTINCT ep.id) AS total_areas,
    ROUND(AVG(ep.percentual_andamento), 2) AS media_percentual,
    
    -- Projetos ativos
    COUNT(ep.id) FILTER (WHERE ep.ativo = true AND ep.data_conclusao IS NULL) AS areas_ativas,
    
    -- Retrabalhos
    COALESCE(SUM(vr.quantidade_retrabalhos), 0) AS total_retrabalhos,
    
    -- Complexidade média
    ROUND(AVG(ct.nivel), 2) AS complexidade_media,
    
    -- Carga de trabalho (soma dos tempos estimados das áreas ativas)
    SUM(ep.tempo_trabalho_dias) FILTER (WHERE ep.ativo = true AND ep.data_conclusao IS NULL) AS dias_trabalho_pendentes,
    
    -- Atrasos
    COUNT(ep.id) FILTER (
        WHERE ep.data_prevista < CURRENT_DATE 
        AND ep.data_conclusao IS NULL 
        AND ep.ativo = true
    ) AS areas_atrasadas

FROM engenheiros e
LEFT JOIN engenheiros_projetos ep ON ep.eng_id = e.eng_id
LEFT JOIN vw_quantidade_retrabalhos vr ON vr.eng_projeto_id = ep.id
LEFT JOIN evandro_distribuicao_tasks edt ON edt.eng_projeto_id = ep.id
LEFT JOIN complexidade_tarefas ct ON ct.complexidade_id = edt.complexidade_id
WHERE e.ativo = true
GROUP BY e.eng_id, e.nome, e.exclusivo
ORDER BY total_projetos DESC;

COMMENT ON VIEW vw_dono_visao_geral IS 'Visão consolidada do dono - estatísticas de todos os engenheiros';

-- =====================================================
-- VIEW: vw_dono_engenheiro_detalhado
-- Detalhamento completo por engenheiro (para o dono)
-- =====================================================

CREATE OR REPLACE VIEW vw_dono_engenheiro_detalhado AS
SELECT 
    e.eng_id,
    e.nome AS engenheiro_nome,
    e.exclusivo,
    
    -- Projeto
    p.projeto_id,
    p.codigo_projeto,
    p.cliente,
    
    -- Área
    a.area_id,
    a.codigo AS area_codigo,
    a.descricao AS area_descricao,
    
    -- Status
    ep.data_inicio,
    ep.data_prevista,
    ep.data_conclusao,
    s.descricao AS status_descricao,
    ep.percentual_andamento AS taxa_execucao,
    ep.tempo_trabalho_dias,
    
    -- Complexidade
    ct.descricao AS complexidade_descricao,
    ct.nivel AS complexidade_nivel,
    
    -- Retrabalhos
    COALESCE(vr.quantidade_retrabalhos, 0) AS quantidade_retrabalhos,
    COALESCE(vr.percentual_retrabalhos, 0) AS percentual_retrabalhos,
    
    -- Prazos
    pr.prazo_final_eng,
    pr.prazo_final_cliente,
    
    -- Atraso
    CASE 
        WHEN ep.data_prevista < CURRENT_DATE AND ep.data_conclusao IS NULL 
        THEN (CURRENT_DATE - ep.data_prevista)::INTEGER
        ELSE 0
    END AS dias_atraso,
    
    -- Última atualização
    (SELECT data_registro FROM projetos_previsao 
     WHERE eng_projeto_id = ep.id 
     ORDER BY data_registro DESC LIMIT 1) AS ultima_atualizacao

FROM engenheiros e
JOIN engenheiros_projetos ep ON ep.eng_id = e.eng_id
JOIN projetos p ON p.projeto_id = ep.projeto_id
JOIN areas a ON a.area_id = ep.area_id
LEFT JOIN status_codes s ON s.status_id = ep.status_id
LEFT JOIN evandro_distribuicao_tasks edt ON edt.eng_projeto_id = ep.id
LEFT JOIN complexidade_tarefas ct ON ct.complexidade_id = edt.complexidade_id
LEFT JOIN vw_quantidade_retrabalhos vr ON vr.eng_projeto_id = ep.id
LEFT JOIN prazos pr ON pr.eng_projeto_id = ep.id
WHERE e.ativo = true AND ep.ativo = true
ORDER BY e.nome, p.codigo_projeto, a.descricao;

COMMENT ON VIEW vw_dono_engenheiro_detalhado IS 'Detalhamento completo de projetos por engenheiro - visão do dono';

-- =====================================================
-- VIEW: vw_dono_retrabalhos_historico
-- Histórico de retrabalhos (para gráficos)
-- =====================================================

CREATE OR REPLACE VIEW vw_dono_retrabalhos_historico AS
SELECT 
    e.eng_id,
    e.nome AS engenheiro_nome,
    p.projeto_id,
    p.codigo_projeto,
    a.descricao AS area_descricao,
    r.data_retrabalho,
    r.necessitou_retrabalho,
    r.motivo_retrabalho,
    r.tipo_retrabalho,
    r.descricao,
    s.descricao AS status_na_epoca
FROM retrabalho_projetos r
JOIN engenheiros_projetos ep ON ep.id = r.eng_projeto_id
JOIN engenheiros e ON e.eng_id = ep.eng_id
JOIN projetos p ON p.projeto_id = ep.projeto_id
JOIN areas a ON a.area_id = ep.area_id
LEFT JOIN status_codes s ON s.status_id = r.status_id
WHERE r.necessitou_retrabalho = true
ORDER BY r.data_retrabalho DESC;

COMMENT ON VIEW vw_dono_retrabalhos_historico IS 'Histórico completo de retrabalhos para análise e gráficos';

-- =====================================================
-- VIEW: vw_dono_retrabalhos_por_motivo
-- Retrabalhos por motivo (para gráficos)
-- =====================================================

CREATE OR REPLACE VIEW vw_dono_retrabalhos_por_motivo AS
SELECT 
    motivo_retrabalho,
    COUNT(*) AS quantidade,
    COUNT(DISTINCT eng_id) AS engenheiros_afetados,
    COUNT(DISTINCT projeto_id) AS projetos_afetados
FROM retrabalho_projetos
WHERE necessitou_retrabalho = true
AND motivo_retrabalho IS NOT NULL
GROUP BY motivo_retrabalho
ORDER BY quantidade DESC;

COMMENT ON VIEW vw_dono_retrabalhos_por_motivo IS 'Agrupamento de retrabalhos por motivo - para gráficos';

-- =====================================================
-- VIEW: vw_dono_taxa_execucao_ranking
-- Taxa de execução por engenheiro (ranking)
-- =====================================================

CREATE OR REPLACE VIEW vw_dono_taxa_execucao_ranking AS
SELECT 
    e.eng_id,
    e.nome AS engenheiro_nome,
    e.exclusivo,
    ROUND(AVG(ep.percentual_andamento), 2) AS taxa_execucao_media,
    COUNT(ep.id) AS total_areas,
    COUNT(ep.id) FILTER (WHERE ep.percentual_andamento = 100) AS areas_concluidas,
    ROUND(
        (COUNT(ep.id) FILTER (WHERE ep.percentual_andamento = 100)::NUMERIC / 
         NULLIF(COUNT(ep.id), 0)) * 100, 
        2
    ) AS percentual_conclusao
FROM engenheiros e
LEFT JOIN engenheiros_projetos ep ON ep.eng_id = e.eng_id AND ep.ativo = true
WHERE e.ativo = true
GROUP BY e.eng_id, e.nome, e.exclusivo
ORDER BY taxa_execucao_media DESC;

COMMENT ON VIEW vw_dono_taxa_execucao_ranking IS 'Ranking de engenheiros por taxa de execução';

-- =====================================================
-- FIM DO ARQUIVO
-- =====================================================
-- 
-- RESUMO DO QUE FOI CRIADO:
-- ✅ 7 Funções e Triggers para cálculos automáticos
-- ✅ 10 Views para consultas consolidadas
-- 
-- Próximo passo: Testar as functions do chatbot!
-- =====================================================

