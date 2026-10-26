-- =====================================================
-- RECRIAR TODAS AS VIEWS DO ZERO
-- =====================================================

-- PASSO 1: DROPAR TODAS AS VIEWS
DROP VIEW IF EXISTS vw_bloco1_visao_geral CASCADE;
DROP VIEW IF EXISTS vw_bloco2_atrasos_engenheiro CASCADE;
DROP VIEW IF EXISTS vw_bloco2_atrasos_area CASCADE;
DROP VIEW IF EXISTS vw_bloco3_carga_trabalho CASCADE;
DROP VIEW IF EXISTS vw_bloco4_execucao_media CASCADE;
DROP VIEW IF EXISTS vw_bloco5_retrabalho_engenheiro CASCADE;
DROP VIEW IF EXISTS vw_bloco5_retrabalho_area CASCADE;
DROP VIEW IF EXISTS vw_grafico_projetos_status CASCADE;
DROP VIEW IF EXISTS vw_grafico_atrasos_engenheiro CASCADE;
DROP VIEW IF EXISTS vw_grafico_carga_trabalho CASCADE;
DROP VIEW IF EXISTS vw_grafico_retrabalho_area CASCADE;
DROP VIEW IF EXISTS vw_projetos_detalhado CASCADE;
DROP VIEW IF EXISTS vw_percentual_retrabalho_geral CASCADE;

-- PASSO 2: RECRIAR TODAS AS VIEWS

-- View auxiliar para retrabalho
CREATE VIEW vw_percentual_retrabalho_geral AS
SELECT 
    ROUND(
        (COUNT(DISTINCT e.eng_id) FILTER (
            WHERE EXISTS (
                SELECT 1 
                FROM engenheiros_projetos ep
                JOIN retrabalho_projetos r ON r.eng_projeto_id = ep.id
                WHERE ep.eng_id = e.eng_id 
                AND r.necessitou_retrabalho = true
            )
        )::NUMERIC / 
        NULLIF(COUNT(DISTINCT e.eng_id), 0)) * 100
    , 2) AS percentual_geral_retrabalho
FROM engenheiros e
WHERE e.ativo = true;

-- VIEW 1: Visão Geral
CREATE VIEW vw_bloco1_visao_geral AS
SELECT 
    COUNT(DISTINCT p.projeto_id) AS total_projetos,
    COUNT(DISTINCT p.projeto_id) FILTER (
        WHERE NOT EXISTS (
            SELECT 1 FROM engenheiros_projetos ep2 
            WHERE ep2.projeto_id = p.projeto_id 
            AND ep2.data_conclusao IS NULL 
            AND ep2.ativo = true
        )
    ) AS projetos_concluidos,
    COUNT(DISTINCT p.projeto_id) FILTER (
        WHERE EXISTS (
            SELECT 1 FROM engenheiros_projetos ep2 
            WHERE ep2.projeto_id = p.projeto_id 
            AND ep2.data_conclusao IS NULL 
            AND ep2.ativo = true
        )
    ) AS projetos_em_execucao,
    COUNT(DISTINCT p.projeto_id) FILTER (
        WHERE EXISTS (
            SELECT 1 FROM engenheiros_projetos ep2 
            WHERE ep2.projeto_id = p.projeto_id 
            AND ep2.data_prevista::DATE < CURRENT_DATE
            AND ep2.data_conclusao IS NULL 
            AND ep2.ativo = true
        )
    ) AS projetos_atrasados,
    ROUND(COALESCE(AVG(ep.percentual_andamento), 0), 2) AS percentual_concluido_medio,
    COUNT(ep.id) AS total_areas,
    COUNT(ep.id) FILTER (WHERE ep.data_conclusao IS NOT NULL) AS areas_concluidas,
    COUNT(ep.id) FILTER (WHERE ep.data_conclusao IS NULL AND ep.ativo = true) AS areas_ativas
FROM projetos p
LEFT JOIN engenheiros_projetos ep ON ep.projeto_id = p.projeto_id AND ep.ativo = true
WHERE p.ativo = true;

-- VIEW 2: Atrasos por Engenheiro
CREATE VIEW vw_bloco2_atrasos_engenheiro AS
SELECT 
    e.eng_id,
    e.nome AS engenheiro,
    COUNT(DISTINCT ep.projeto_id) FILTER (
        WHERE ep.data_prevista::DATE < CURRENT_DATE 
        AND ep.data_conclusao IS NULL
    ) AS qtde_projetos_atrasados,
    COUNT(ep.id) FILTER (
        WHERE ep.data_prevista::DATE < CURRENT_DATE 
        AND ep.data_conclusao IS NULL
    ) AS qtde_areas_atrasadas,
    ROUND(AVG(
        CASE 
            WHEN ep.data_prevista::DATE < CURRENT_DATE AND ep.data_conclusao IS NULL 
            THEN (CURRENT_DATE - ep.data_prevista::DATE)
            ELSE NULL
        END
    ), 2) AS dias_medios_atraso,
    MAX(
        CASE 
            WHEN ep.data_prevista::DATE < CURRENT_DATE AND ep.data_conclusao IS NULL 
            THEN (CURRENT_DATE - ep.data_prevista::DATE)
            ELSE 0
        END
    ) AS atraso_maximo_dias
FROM engenheiros e
LEFT JOIN engenheiros_projetos ep ON ep.eng_id = e.eng_id AND ep.ativo = true
WHERE e.ativo = true
GROUP BY e.eng_id, e.nome
HAVING COUNT(ep.id) FILTER (
    WHERE ep.data_prevista::DATE < CURRENT_DATE 
    AND ep.data_conclusao IS NULL
) > 0
ORDER BY dias_medios_atraso DESC;

-- VIEW 3: Atrasos por Área
CREATE VIEW vw_bloco2_atrasos_area AS
SELECT 
    a.area_id,
    a.codigo AS area_codigo,
    a.descricao AS area,
    COUNT(ep.id) FILTER (
        WHERE ep.data_prevista::DATE < CURRENT_DATE 
        AND ep.data_conclusao IS NULL
    ) AS qtde_atrasados,
    ROUND(AVG(
        CASE 
            WHEN ep.data_prevista::DATE < CURRENT_DATE AND ep.data_conclusao IS NULL 
            THEN (CURRENT_DATE - ep.data_prevista::DATE)
            ELSE NULL
        END
    ), 2) AS dias_medio_atraso,
    COUNT(DISTINCT ep.projeto_id) AS total_projetos_area
FROM areas a
LEFT JOIN engenheiros_projetos ep ON ep.area_id = a.area_id AND ep.ativo = true
WHERE a.ativo = true
GROUP BY a.area_id, a.codigo, a.descricao
HAVING COUNT(ep.id) FILTER (
    WHERE ep.data_prevista::DATE < CURRENT_DATE 
    AND ep.data_conclusao IS NULL
) > 0
ORDER BY dias_medio_atraso DESC;

-- VIEW 4: Carga de Trabalho
CREATE VIEW vw_bloco3_carga_trabalho AS
SELECT 
    e.eng_id,
    e.nome AS engenheiro,
    e.exclusivo,
    COALESCE(SUM(ep.tempo_trabalho_dias) FILTER (
        WHERE ep.data_conclusao IS NULL AND ep.ativo = true
    ), 0) AS dias_estimados_totais,
    ROUND(COALESCE(AVG(ep.percentual_andamento) FILTER (
        WHERE ep.data_conclusao IS NULL AND ep.ativo = true
    ), 0), 2) AS percentual_execucao_media,
    ROUND(
        COALESCE(SUM(
            ep.tempo_trabalho_dias * (100 - ep.percentual_andamento) / 100.0
        ) FILTER (WHERE ep.data_conclusao IS NULL AND ep.ativo = true), 0)
    , 0) AS dias_restantes,
    COUNT(ep.id) FILTER (WHERE ep.data_conclusao IS NULL AND ep.ativo = true) AS areas_ativas,
    COUNT(DISTINCT ep.projeto_id) FILTER (WHERE ep.data_conclusao IS NULL AND ep.ativo = true) AS projetos_ativos
FROM engenheiros e
LEFT JOIN engenheiros_projetos ep ON ep.eng_id = e.eng_id
WHERE e.ativo = true
GROUP BY e.eng_id, e.nome, e.exclusivo
ORDER BY dias_restantes DESC;

-- VIEW 5: Execução Média
CREATE VIEW vw_bloco4_execucao_media AS
SELECT 
    e.eng_id,
    e.nome AS engenheiro,
    COALESCE(SUM(a.tempo_trabalho_dias), 0) AS dias_estimados_totais,
    ROUND(
        COALESCE(SUM(a.tempo_trabalho_dias * ep.percentual_andamento / 100.0), 0)
    , 0) AS dias_executados,
    ROUND(COALESCE(AVG(ep.percentual_andamento), 0), 2) AS percentual_execucao_media,
    ROUND(
        COALESCE(SUM(a.tempo_trabalho_dias * (100 - ep.percentual_andamento) / 100.0), 0)
    , 0) AS dias_restantes
FROM engenheiros e
LEFT JOIN engenheiros_projetos ep ON ep.eng_id = e.eng_id AND ep.ativo = true
LEFT JOIN areas a ON a.area_id = ep.area_id
WHERE e.ativo = true
GROUP BY e.eng_id, e.nome
ORDER BY percentual_execucao_media DESC;

-- VIEW 6: Retrabalho por Engenheiro (CORRIGIDO)
CREATE VIEW vw_bloco5_retrabalho_engenheiro AS
SELECT 
    e.eng_id,
    e.nome AS engenheiro,
    COUNT(DISTINCT r.eng_projeto_id) AS qtde_areas_retrabalho,
    COUNT(r.id) FILTER (WHERE r.necessitou_retrabalho = true) AS total_retrabalhos,
    (SELECT percentual_geral_retrabalho FROM vw_percentual_retrabalho_geral) AS retrabalho_medio_percentual,
    COUNT(DISTINCT ep.projeto_id) FILTER (
        WHERE EXISTS (
            SELECT 1 FROM retrabalho_projetos r2 
            WHERE r2.eng_projeto_id = ep.id 
            AND r2.necessitou_retrabalho = true
        )
    ) AS projetos_com_retrabalho
FROM engenheiros e
LEFT JOIN engenheiros_projetos ep ON ep.eng_id = e.eng_id AND ep.ativo = true
LEFT JOIN retrabalho_projetos r ON r.eng_projeto_id = ep.id
WHERE e.ativo = true
GROUP BY e.eng_id, e.nome
HAVING COUNT(r.id) FILTER (WHERE r.necessitou_retrabalho = true) > 0
ORDER BY total_retrabalhos DESC;

-- VIEW 7: Retrabalho por Área
CREATE VIEW vw_bloco5_retrabalho_area AS
SELECT 
    a.area_id,
    a.codigo AS area_codigo,
    a.descricao AS area,
    COUNT(r.id) FILTER (WHERE r.necessitou_retrabalho = true) AS qtde_retrabalhos,
    COUNT(DISTINCT ep.projeto_id) AS projetos_afetados,
    ROUND(
        (COUNT(DISTINCT r.eng_projeto_id)::NUMERIC / 
         NULLIF(COUNT(DISTINCT ep.id), 0)) * 100
    , 2) AS percentual_areas_retrabalho
FROM areas a
LEFT JOIN engenheiros_projetos ep ON ep.area_id = a.area_id AND ep.ativo = true
LEFT JOIN retrabalho_projetos r ON r.eng_projeto_id = ep.id
WHERE a.ativo = true
GROUP BY a.area_id, a.codigo, a.descricao
HAVING COUNT(r.id) FILTER (WHERE r.necessitou_retrabalho = true) > 0
ORDER BY qtde_retrabalhos DESC;

-- VIEW 8: Gráfico - Projetos por Status
CREATE VIEW vw_grafico_projetos_status AS
SELECT 
    CASE 
        WHEN NOT EXISTS (
            SELECT 1 FROM engenheiros_projetos ep2 
            WHERE ep2.projeto_id = p.projeto_id 
            AND ep2.data_conclusao IS NULL 
            AND ep2.ativo = true
        ) THEN 'Concluído'
        WHEN EXISTS (
            SELECT 1 FROM engenheiros_projetos ep2 
            WHERE ep2.projeto_id = p.projeto_id 
            AND ep2.data_prevista::DATE < CURRENT_DATE
            AND ep2.data_conclusao IS NULL 
            AND ep2.ativo = true
        ) THEN 'Atrasado'
        WHEN EXISTS (
            SELECT 1 FROM engenheiros_projetos ep2 
            WHERE ep2.projeto_id = p.projeto_id 
            AND ep2.data_inicio::DATE <= CURRENT_DATE
            AND ep2.data_conclusao IS NULL 
            AND ep2.ativo = true
        ) THEN 'Em Andamento'
        ELSE 'Aguardando'
    END AS status,
    COUNT(DISTINCT p.projeto_id) AS quantidade,
    ROUND(
        (COUNT(DISTINCT p.projeto_id)::NUMERIC / 
         (SELECT COUNT(DISTINCT projeto_id) FROM projetos WHERE ativo = true)) * 100
    , 2) AS percentual
FROM projetos p
WHERE p.ativo = true
GROUP BY 
    CASE 
        WHEN NOT EXISTS (
            SELECT 1 FROM engenheiros_projetos ep2 
            WHERE ep2.projeto_id = p.projeto_id 
            AND ep2.data_conclusao IS NULL 
            AND ep2.ativo = true
        ) THEN 'Concluído'
        WHEN EXISTS (
            SELECT 1 FROM engenheiros_projetos ep2 
            WHERE ep2.projeto_id = p.projeto_id 
            AND ep2.data_prevista::DATE < CURRENT_DATE
            AND ep2.data_conclusao IS NULL 
            AND ep2.ativo = true
        ) THEN 'Atrasado'
        WHEN EXISTS (
            SELECT 1 FROM engenheiros_projetos ep2 
            WHERE ep2.projeto_id = p.projeto_id 
            AND ep2.data_inicio::DATE <= CURRENT_DATE
            AND ep2.data_conclusao IS NULL 
            AND ep2.ativo = true
        ) THEN 'Em Andamento'
        ELSE 'Aguardando'
    END
ORDER BY quantidade DESC;

-- VIEW 9: Gráfico - Atrasos por Engenheiro
CREATE VIEW vw_grafico_atrasos_engenheiro AS
SELECT 
    e.nome AS engenheiro,
    COUNT(ep.id) FILTER (
        WHERE ep.data_prevista::DATE < CURRENT_DATE 
        AND ep.data_conclusao IS NULL
    ) AS qtde_atrasados
FROM engenheiros e
LEFT JOIN engenheiros_projetos ep ON ep.eng_id = e.eng_id AND ep.ativo = true
WHERE e.ativo = true
GROUP BY e.eng_id, e.nome
ORDER BY qtde_atrasados DESC;

-- VIEW 10: Gráfico - Carga de Trabalho
CREATE VIEW vw_grafico_carga_trabalho AS
SELECT 
    e.nome AS engenheiro,
    ROUND(
        COALESCE(SUM(ep.tempo_trabalho_dias * ep.percentual_andamento / 100.0) FILTER (
            WHERE ep.data_conclusao IS NULL AND ep.ativo = true
        ), 0)
    , 0) AS dias_concluidos,
    ROUND(
        COALESCE(SUM(ep.tempo_trabalho_dias * (100 - ep.percentual_andamento) / 100.0) FILTER (
            WHERE ep.data_conclusao IS NULL AND ep.ativo = true
        ), 0)
    , 0) AS dias_restantes
FROM engenheiros e
LEFT JOIN engenheiros_projetos ep ON ep.eng_id = e.eng_id
WHERE e.ativo = true
GROUP BY e.eng_id, e.nome
ORDER BY COALESCE(SUM(ep.tempo_trabalho_dias), 0) DESC;

-- VIEW 11: Gráfico - Retrabalho por Área
CREATE VIEW vw_grafico_retrabalho_area AS
SELECT 
    a.descricao AS area,
    COUNT(r.id) FILTER (WHERE r.necessitou_retrabalho = true) AS qtde_retrabalhos
FROM areas a
LEFT JOIN engenheiros_projetos ep ON ep.area_id = a.area_id AND ep.ativo = true
LEFT JOIN retrabalho_projetos r ON r.eng_projeto_id = ep.id
WHERE a.ativo = true
GROUP BY a.area_id, a.descricao
ORDER BY qtde_retrabalhos DESC;

-- VIEW 12: Projetos Detalhados
CREATE VIEW vw_projetos_detalhado AS
SELECT 
    p.projeto_id,
    p.codigo_projeto,
    COALESCE(p.cliente, 'Sem cliente') AS cliente,
    p.descricao,
    COALESCE(e.nome, 'Sem engenheiro') AS engenheiro_nome,
    COALESCE(a.descricao, 'Sem área') AS area_descricao,
    CASE 
        WHEN ep.data_conclusao IS NOT NULL THEN 'Concluído'
        WHEN ep.data_prevista::DATE < CURRENT_DATE AND ep.data_conclusao IS NULL THEN 'Atrasado'
        WHEN ep.data_inicio::DATE <= CURRENT_DATE AND ep.data_conclusao IS NULL THEN 'Em Andamento'
        ELSE 'Aguardando'
    END AS status_descricao,
    COALESCE(ep.percentual_andamento, 0) AS percentual_andamento,
    ep.data_inicio,
    ep.data_prevista,
    ep.data_conclusao,
    CASE 
        WHEN ep.data_prevista::DATE < CURRENT_DATE AND ep.data_conclusao IS NULL 
        THEN (CURRENT_DATE - ep.data_prevista::DATE)
        ELSE 0
    END AS dias_atraso,
    p.ativo,
    p.created_at
FROM projetos p
LEFT JOIN engenheiros_projetos ep ON ep.projeto_id = p.projeto_id AND ep.ativo = true
LEFT JOIN engenheiros e ON e.eng_id = ep.eng_id
LEFT JOIN areas a ON a.area_id = ep.area_id
WHERE p.ativo = true
ORDER BY p.created_at DESC;

-- SUCESSO!
SELECT 'Todas as views foram recriadas com sucesso!' as status;
