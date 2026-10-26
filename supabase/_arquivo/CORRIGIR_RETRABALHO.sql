-- =====================================================
-- CORREÇÃO: Cálculo de Retrabalho por Engenheiro
-- Percentual = (Engenheiros com retrabalho / Total engenheiros) * 100
-- =====================================================

-- Dropar views antigas primeiro
DROP VIEW IF EXISTS vw_bloco5_retrabalho_engenheiro CASCADE;
DROP VIEW IF EXISTS vw_percentual_retrabalho_geral CASCADE;

-- PASSO 1: View auxiliar para calcular o percentual geral
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

-- PASSO 2: View principal com o percentual correto
CREATE VIEW vw_bloco5_retrabalho_engenheiro AS
SELECT 
    e.eng_id,
    e.nome AS engenheiro,
    
    -- Qtde de áreas com retrabalho
    COUNT(DISTINCT r.eng_projeto_id) AS qtde_areas_retrabalho,
    
    -- Total de retrabalhos
    COUNT(r.id) FILTER (WHERE r.necessitou_retrabalho = true) AS total_retrabalhos,
    
    -- Percentual de retrabalho CORRETO (mesmo para todos)
    -- (Engenheiros com retrabalho / Total de engenheiros na empresa) * 100
    (SELECT percentual_geral_retrabalho FROM vw_percentual_retrabalho_geral) AS retrabalho_medio_percentual,
    
    -- Projetos afetados por retrabalho
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

-- TESTE: Ver o cálculo
SELECT 
    'Cálculo Geral:' as info,
    eng_com_retrabalho,
    total_engenheiros,
    percentual_geral_retrabalho,
    CONCAT(eng_com_retrabalho, ' de ', total_engenheiros, ' engenheiros = ', percentual_geral_retrabalho, '%') as formula
FROM vw_percentual_retrabalho_geral;

SELECT 
    'Por Engenheiro:' as info,
    engenheiro,
    total_retrabalhos,
    retrabalho_medio_percentual as percentual
FROM vw_bloco5_retrabalho_engenheiro;
