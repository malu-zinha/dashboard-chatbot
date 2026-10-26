-- =====================================================
-- FIX: Renomear view antiga e criar nova
-- =====================================================

-- Renomear a view antiga (backup)
ALTER VIEW IF EXISTS vw_bloco5_retrabalho_engenheiro RENAME TO vw_bloco5_retrabalho_engenheiro_OLD;

-- Criar view auxiliar
CREATE OR REPLACE VIEW vw_percentual_retrabalho_geral AS
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

-- Criar nova view com estrutura correta
CREATE VIEW vw_bloco5_retrabalho_engenheiro AS
SELECT 
    e.eng_id,
    e.nome AS engenheiro,
    COUNT(DISTINCT r.eng_projeto_id) AS qtde_areas_retrabalho,
    COUNT(r.id) FILTER (WHERE r.necessitou_retrabalho = true) AS total_retrabalhos,
    -- PERCENTUAL CORRETO: (eng com retrabalho / total eng) * 100
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

-- Dropar a view antiga (agora que a nova está criada)
DROP VIEW IF EXISTS vw_bloco5_retrabalho_engenheiro_OLD;

-- Teste
SELECT 
    'CÁLCULO GERAL' as info,
    CONCAT(eng_com_retrabalho, ' de ', total_engenheiros, ' eng = ', percentual_geral_retrabalho, '%') as resultado
FROM vw_percentual_retrabalho_geral;

SELECT 
    'POR ENGENHEIRO' as info,
    CONCAT(engenheiro, ': ', retrabalho_medio_percentual, '%') as resultado
FROM vw_bloco5_retrabalho_engenheiro
LIMIT 3;
