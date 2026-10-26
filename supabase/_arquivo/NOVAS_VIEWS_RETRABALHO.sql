-- =====================================================
-- NOVAS VIEWS: Retrabalho por Área por Projeto e Motivos por Projeto
-- =====================================================
-- Execute este script no SQL Editor do Supabase
-- =====================================================

-- VIEW 1: Retrabalhos agrupados por área dentro de cada projeto
-- Usada para mostrar a tabela "Por Área" no modal de detalhes
CREATE OR REPLACE VIEW vw_retrabalho_por_area_projeto AS
SELECT
    p.projeto_id,
    p.codigo_projeto,
    p.cliente,
    a.area_id,
    a.codigo AS area_codigo,
    a.descricao AS area,
    COUNT(r.id) AS total_retrabalhos_area
FROM projetos p
LEFT JOIN engenheiros_projetos ep
    ON ep.projeto_id = p.projeto_id AND ep.ativo = true
LEFT JOIN areas a
    ON a.area_id = ep.area_id
LEFT JOIN retrabalho_projetos r
    ON r.eng_projeto_id = ep.id AND r.necessitou_retrabalho = true
WHERE p.ativo = true
GROUP BY p.projeto_id, p.codigo_projeto, p.cliente, a.area_id, a.codigo, a.descricao
HAVING COUNT(r.id) > 0;

COMMENT ON VIEW vw_retrabalho_por_area_projeto IS 'Retrabalhos agrupados por área dentro de cada projeto - para drill-down no modal';

-- VIEW 2: Motivos agrupados por projeto
-- Usada para o gráfico de pizza de motivos por projeto
CREATE OR REPLACE VIEW vw_retrabalho_motivos_por_projeto AS
SELECT
    p.projeto_id,
    p.codigo_projeto,
    p.cliente,
    r.motivo_retrabalho,
    COUNT(*) AS quantidade
FROM retrabalho_projetos r
JOIN projetos p ON p.projeto_id = r.projeto_id
WHERE r.necessitou_retrabalho = true
  AND r.motivo_retrabalho IS NOT NULL
GROUP BY p.projeto_id, p.codigo_projeto, p.cliente, r.motivo_retrabalho
ORDER BY p.codigo_projeto, quantidade DESC;

COMMENT ON VIEW vw_retrabalho_motivos_por_projeto IS 'Motivos de retrabalho agrupados por projeto - para gráfico de pizza por projeto';

-- VIEW 3: Atualizar vw_retrabalho_detalhes_projeto para incluir área
-- Necessário para expandir retrabalhos por área no modal
CREATE OR REPLACE VIEW vw_retrabalho_detalhes_projeto AS
SELECT
    r.id AS retrabalho_id,
    r.projeto_id,
    p.codigo_projeto,
    p.cliente,
    r.data_retrabalho,
    ep.eng_id,
    e.nome AS engenheiro_nome,
    r.motivo_retrabalho,
    ep.area_id,
    a.codigo AS area_codigo,
    a.descricao AS area_descricao
FROM retrabalho_projetos r
JOIN projetos p ON p.projeto_id = r.projeto_id
JOIN engenheiros_projetos ep ON ep.id = r.eng_projeto_id
JOIN engenheiros e ON e.eng_id = ep.eng_id
JOIN areas a ON a.area_id = ep.area_id
WHERE r.necessitou_retrabalho = true
ORDER BY p.codigo_projeto, a.codigo, r.data_retrabalho DESC;

COMMENT ON VIEW vw_retrabalho_detalhes_projeto IS 'Detalhamento de retrabalhos por projeto com área: data, engenheiro, motivo e área';

-- VIEW 4: Taxa de retrabalho por área por projeto
-- Fórmula: total_retrabalhos_area / dias_distintos_com_registro_de_retrabalho_no_projeto
-- "dias de registro" = COUNT(DISTINCT data_retrabalho) em retrabalho_projetos para aquele projeto
CREATE OR REPLACE VIEW vw_retrabalho_taxa_area_projeto AS
WITH dias_projeto AS (
    SELECT
        projeto_id,
        COUNT(DISTINCT data_retrabalho) AS dias_com_registro
    FROM retrabalho_projetos
    GROUP BY projeto_id
),
retrabalhos_area AS (
    SELECT
        p.projeto_id,
        p.codigo_projeto,
        p.cliente,
        a.area_id,
        a.codigo   AS area_codigo,
        a.descricao AS area,
        COUNT(r.id) AS total_retrabalhos_area
    FROM projetos p
    JOIN engenheiros_projetos ep
        ON ep.projeto_id = p.projeto_id AND ep.ativo = true
    JOIN areas a
        ON a.area_id = ep.area_id
    JOIN retrabalho_projetos r
        ON r.eng_projeto_id = ep.id AND r.necessitou_retrabalho = true
    WHERE p.ativo = true
    GROUP BY p.projeto_id, p.codigo_projeto, p.cliente, a.area_id, a.codigo, a.descricao
    HAVING COUNT(r.id) > 0
)
SELECT
    ra.projeto_id,
    ra.codigo_projeto,
    ra.cliente,
    ra.area_id,
    ra.area_codigo,
    ra.area,
    ra.total_retrabalhos_area,
    dp.dias_com_registro,
    ROUND(
        ra.total_retrabalhos_area::numeric / NULLIF(dp.dias_com_registro, 0),
        2
    ) AS taxa_retrabalho_por_dia
FROM retrabalhos_area ra
JOIN dias_projeto dp ON dp.projeto_id = ra.projeto_id
ORDER BY taxa_retrabalho_por_dia DESC;

COMMENT ON VIEW vw_retrabalho_taxa_area_projeto IS
'Taxa de retrabalho por área: total_retrabalhos_area / dias_distintos_com_registro_no_projeto';

-- OBSERVAÇÃO: vw_dono_retrabalhos_por_motivo (pizza geral TecPred) já existe
-- Estrutura: motivo_retrabalho, quantidade, engenheiros_afetados, projetos_afetados
