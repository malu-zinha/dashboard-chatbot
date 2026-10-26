-- =====================================================
-- TABELA EVANDRO - GERENCIAL/DONO DA EMPRESA
-- Distribuição de tarefas e visão consolidada
-- =====================================================

-- =====================================================
-- TABELA: dono_empresa
-- =====================================================
-- Cadastro do dono/gestor com permissões especiais
-- =====================================================

CREATE TABLE IF NOT EXISTS dono_empresa (
    dono_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL,
    email TEXT UNIQUE,
    telefone TEXT,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_dono_ativo ON dono_empresa(ativo);

COMMENT ON TABLE dono_empresa IS 'Cadastro do dono/gestor da empresa com permissões especiais';

-- =====================================================
-- TABELA: complexidade_tarefas
-- =====================================================
-- Tabela de decodificação de complexidade
-- Será preenchida com os dados que você enviar
-- =====================================================

CREATE TABLE IF NOT EXISTS complexidade_tarefas (
    complexidade_id SERIAL PRIMARY KEY,
    codigo TEXT UNIQUE NOT NULL,
    descricao TEXT NOT NULL,
    nivel INTEGER NOT NULL, -- 1 (baixa) a 5 (muito alta)
    tempo_estimado_dias INTEGER,
    observacoes TEXT,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_complexidade_nivel ON complexidade_tarefas(nivel);
CREATE INDEX idx_complexidade_ativo ON complexidade_tarefas(ativo);

COMMENT ON TABLE complexidade_tarefas IS 'Níveis de complexidade das tarefas';

-- Seed inicial de complexidades (ajustar conforme sua tabela)
INSERT INTO complexidade_tarefas (codigo, descricao, nivel, tempo_estimado_dias) VALUES
    ('MUITO_SIMPLES', 'Muito Simples', 1, 1),
    ('SIMPLES', 'Simples', 2, 3),
    ('MEDIA', 'Média', 3, 7),
    ('COMPLEXA', 'Complexa', 4, 15),
    ('MUITO_COMPLEXA', 'Muito Complexa', 5, 30)
ON CONFLICT (codigo) DO NOTHING;

-- =====================================================
-- TABELA: evandro_distribuicao_tasks
-- =====================================================
-- Distribuição de tarefas pelo dono para engenheiros
-- Sincroniza automaticamente com engenheiros_projetos via TRIGGER
-- =====================================================

CREATE TABLE IF NOT EXISTS evandro_distribuicao_tasks (
    task_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Quem distribuiu
    dono_id UUID REFERENCES dono_empresa(dono_id),
    
    -- Para quem
    eng_id UUID NOT NULL REFERENCES engenheiros(eng_id),
    
    -- Projeto (pode ser novo ou existente)
    projeto_id UUID REFERENCES projetos(projeto_id),
    codigo_projeto TEXT, -- Caso seja projeto novo
    cliente TEXT,
    
    -- Área designada
    area_id INTEGER NOT NULL REFERENCES areas(area_id),
    
    -- Complexidade
    complexidade_id INTEGER REFERENCES complexidade_tarefas(complexidade_id),
    
    -- Descrição da task
    descricao_task TEXT NOT NULL,
    
    -- Datas
    data_atribuicao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    data_inicio_prevista DATE,
    data_conclusao_prevista DATE,
    
    -- Status da task
    status_task TEXT DEFAULT 'PENDENTE', -- PENDENTE, ACEITA, EM_ANDAMENTO, CONCLUIDA
    
    -- Notificação
    notificacao_enviada BOOLEAN DEFAULT false,
    data_notificacao TIMESTAMP WITH TIME ZONE,
    
    -- Sincronização com engenheiros_projetos
    eng_projeto_id UUID REFERENCES engenheiros_projetos(id), -- Preenchido após sincronizar
    sincronizado BOOLEAN DEFAULT false,
    data_sincronizacao TIMESTAMP WITH TIME ZONE,
    
    -- Observações do dono
    observacoes_dono TEXT,
    
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_evandro_tasks_dono ON evandro_distribuicao_tasks(dono_id);
CREATE INDEX idx_evandro_tasks_eng ON evandro_distribuicao_tasks(eng_id);
CREATE INDEX idx_evandro_tasks_projeto ON evandro_distribuicao_tasks(projeto_id);
CREATE INDEX idx_evandro_tasks_area ON evandro_distribuicao_tasks(area_id);
CREATE INDEX idx_evandro_tasks_status ON evandro_distribuicao_tasks(status_task);
CREATE INDEX idx_evandro_tasks_sincronizado ON evandro_distribuicao_tasks(sincronizado);
CREATE INDEX idx_evandro_tasks_notificacao ON evandro_distribuicao_tasks(notificacao_enviada);

COMMENT ON TABLE evandro_distribuicao_tasks IS 'Distribuição de tarefas pelo dono - sincroniza automaticamente com engenheiros';
COMMENT ON COLUMN evandro_distribuicao_tasks.notificacao_enviada IS 'TRUE quando notificação WhatsApp foi enviada';
COMMENT ON COLUMN evandro_distribuicao_tasks.sincronizado IS 'TRUE quando task foi criada em engenheiros_projetos';

-- =====================================================
-- TABELA: notificacoes_whatsapp
-- =====================================================
-- Fila de notificações para envio via WhatsApp
-- =====================================================

CREATE TABLE IF NOT EXISTS notificacoes_whatsapp (
    notificacao_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Destinatário
    eng_id UUID NOT NULL REFERENCES engenheiros(eng_id),
    telefone TEXT,
    
    -- Tipo de notificação
    tipo TEXT NOT NULL, -- NOVA_TAREFA, PRAZO_VENCIDO, ATRASO, etc.
    
    -- Conteúdo
    titulo TEXT NOT NULL,
    mensagem TEXT NOT NULL,
    
    -- Referências
    task_id UUID REFERENCES evandro_distribuicao_tasks(task_id),
    projeto_id UUID REFERENCES projetos(projeto_id),
    
    -- Status de envio
    enviada BOOLEAN DEFAULT false,
    data_envio TIMESTAMP WITH TIME ZONE,
    erro_envio TEXT,
    tentativas INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notif_eng ON notificacoes_whatsapp(eng_id);
CREATE INDEX idx_notif_enviada ON notificacoes_whatsapp(enviada);
CREATE INDEX idx_notif_tipo ON notificacoes_whatsapp(tipo);
CREATE INDEX idx_notif_created ON notificacoes_whatsapp(created_at);

COMMENT ON TABLE notificacoes_whatsapp IS 'Fila de notificações para WhatsApp';

-- =====================================================
-- TRIGGER: Sincronizar task com engenheiros_projetos
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
        
        -- 5. Cria notificação para WhatsApp
        INSERT INTO notificacoes_whatsapp (
            eng_id,
            tipo,
            titulo,
            mensagem,
            task_id,
            projeto_id
        ) VALUES (
            NEW.eng_id,
            'NOVA_TAREFA',
            '🆕 Nova Tarefa Atribuída!',
            '📋 Projeto: ' || COALESCE(NEW.codigo_projeto, 
                (SELECT codigo_projeto FROM projetos WHERE projeto_id = v_projeto_id)) || 
            '\n📦 Área: ' || (SELECT descricao FROM areas WHERE area_id = NEW.area_id) ||
            '\n📝 Descrição: ' || NEW.descricao_task ||
            '\n📅 Início previsto: ' || COALESCE(NEW.data_inicio_prevista::TEXT, 'Não definido') ||
            '\n⏰ Conclusão prevista: ' || COALESCE(NEW.data_conclusao_prevista::TEXT, 'Não definido'),
            NEW.task_id,
            v_projeto_id
        );
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sincronizar_task
    BEFORE INSERT OR UPDATE ON evandro_distribuicao_tasks
    FOR EACH ROW
    EXECUTE FUNCTION sincronizar_task_para_engenheiro();

COMMENT ON FUNCTION sincronizar_task_para_engenheiro IS 'Sincroniza automaticamente tasks com engenheiros_projetos e cria notificação';

-- =====================================================
-- VIEW: Visão consolidada do dono (todos os engenheiros)
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
-- VIEW: Detalhamento completo por engenheiro (para o dono)
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
        THEN EXTRACT(DAY FROM (CURRENT_DATE - ep.data_prevista))::INTEGER
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
-- VIEW: Histórico de retrabalhos (para gráficos)
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
-- VIEW: Retrabalhos por motivo (para gráficos)
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
-- VIEW: Taxa de execução por engenheiro (ranking)
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
-- Seed: Criar dono padrão (Evandro)
-- =====================================================

INSERT INTO dono_empresa (nome, email) VALUES
    ('Evandro', 'evandro@empresa.com')
ON CONFLICT (email) DO NOTHING;




