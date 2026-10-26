-- View para listagem de projetos detalhada
CREATE OR REPLACE VIEW vw_projetos_detalhado AS
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
    ep.observacoes AS motivo_aguardo,
    p.ativo,
    p.created_at
FROM projetos p
LEFT JOIN engenheiros_projetos ep ON ep.projeto_id = p.projeto_id AND ep.ativo = true
LEFT JOIN engenheiros e ON e.eng_id = ep.eng_id
LEFT JOIN areas a ON a.area_id = ep.area_id
WHERE p.ativo = true
ORDER BY p.created_at DESC;
