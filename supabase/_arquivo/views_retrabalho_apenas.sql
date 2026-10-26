-- Execute este script no SQL Editor do Supabase para criar as views de retrabalho.
-- Assim o card "Retrabalho por Engenheiro" passa a mostrar: % Geral TecPred, Por projeto e clique para detalhes.

CREATE OR REPLACE VIEW vw_retrabalho_geral AS
SELECT
    COUNT(r.id) AS total_retrabalhos_geral,
    COUNT(DISTINCT p.projeto_id) AS total_projetos_ativos,
    ROUND(
        CASE 
            WHEN COUNT(DISTINCT p.projeto_id) = 0 THEN 0
            ELSE (COUNT(r.id)::NUMERIC / COUNT(DISTINCT p.projeto_id)::NUMERIC) * 100
        END,
        2
    ) AS percentual_geral_retrabalho
FROM projetos p
LEFT JOIN retrabalho_projetos r 
    ON r.projeto_id = p.projeto_id 
   AND r.necessitou_retrabalho = true
WHERE p.ativo = true;

CREATE OR REPLACE VIEW vw_retrabalho_por_projeto AS
SELECT
    p.projeto_id,
    p.codigo_projeto,
    p.cliente,
    COUNT(r.id) AS total_retrabalhos_projeto,
    COUNT(DISTINCT ep.eng_id) AS total_engenheiros_projeto,
    ROUND(
        CASE 
            WHEN COUNT(DISTINCT ep.eng_id) = 0 THEN 0
            ELSE (COUNT(r.id)::NUMERIC / COUNT(DISTINCT ep.eng_id)::NUMERIC) * 100
        END,
        2
    ) AS percentual_retrabalho_projeto
FROM projetos p
LEFT JOIN engenheiros_projetos ep 
    ON ep.projeto_id = p.projeto_id 
   AND ep.ativo = true
LEFT JOIN retrabalho_projetos r 
    ON r.projeto_id = p.projeto_id 
   AND r.necessitou_retrabalho = true
WHERE p.ativo = true
GROUP BY p.projeto_id, p.codigo_projeto, p.cliente;

CREATE OR REPLACE VIEW vw_retrabalho_detalhes_projeto AS
SELECT
    r.id AS retrabalho_id,
    r.projeto_id,
    p.codigo_projeto,
    p.cliente,
    r.data_retrabalho,
    ep.eng_id,
    e.nome AS engenheiro_nome,
    r.motivo_retrabalho
FROM retrabalho_projetos r
JOIN projetos p ON p.projeto_id = r.projeto_id
JOIN engenheiros_projetos ep ON ep.id = r.eng_projeto_id
JOIN engenheiros e ON e.eng_id = ep.eng_id
WHERE r.necessitou_retrabalho = true
ORDER BY p.codigo_projeto, r.data_retrabalho DESC;
