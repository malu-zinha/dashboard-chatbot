-- =====================================================
-- CORREÇÃO: Cálculo de Retrabalho (COM FORCE)
-- =====================================================

-- Dropar TODAS as views de retrabalho com CASCADE
DROP VIEW IF EXISTS vw_bloco5_retrabalho_engenheiro CASCADE;
DROP VIEW IF EXISTS vw_bloco5_retrabalho_area CASCADE;
DROP VIEW IF EXISTS vw_percentual_retrabalho_geral CASCADE;
DROP VIEW IF EXISTS vw_grafico_retrabalho_area CASCADE;

-- =====================================================
-- RECRIAR: View auxiliar para calcular percentual geral
-- =====================================================
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
    , 2) AS percentual_geral_retrabalho,
    COUNT(DISTINCT e.eng_id) FILTER (
        WHERE EXISTS (
            SELECT 1 
            FROM engenheiros_projetos ep
            JOIN retrabalho_projetos r ON r.eng_projeto_id = ep.id
            WHERE ep.eng_id = e.eng_id 
            AND r.necessitou_retrabalho = true
        )
    ) AS eng_com_retrabalho,
    COUNT(DISTINCT e.eng_id) AS total_engenheiros
FROM engenheiros e
WHERE e.ativo = true;

-- =====================================================
-- RECRIAR: Retrabalho por Engenheiro (CORRIGIDO)
-- =====================================================
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

-- =====================================================
-- RECRIAR: Retrabalho por Área
-- =====================================================
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

-- =====================================================
-- RECRIAR: Gráfico Retrabalho por Área
-- =====================================================
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

-- =====================================================
-- TESTE
-- =====================================================
SELECT 'Percentual Geral' as tipo, 
       CONCAT(eng_com_retrabalho, ' de ', total_engenheiros, ' eng = ', percentual_geral_retrabalho, '%') as resultado
FROM vw_percentual_retrabalho_geral;
