-- =====================================================
-- VIEW PARA LISTAGEM DETALHADA DE PROJETOS
-- Retorna todos os projetos com informações completas
-- =====================================================

CREATE OR REPLACE VIEW vw_projetos_detalhado AS
SELECT 
    p.projeto_id,
    p.codigo_projeto,
    p.cliente,
    p.descricao,
    e.nome AS engenheiro_nome,
    a.descricao AS area_descricao,
    COALESCE(s.descricao, 
        CASE 
            WHEN ep.data_conclusao IS NOT NULL THEN 'Concluído'
            WHEN ep.data_prevista::DATE < CURRENT_DATE THEN 'Atrasado'
            WHEN ep.data_inicio::DATE <= CURRENT_DATE THEN 'Em Andamento'
            ELSE 'Aguardando'
        END
    ) AS status_descricao,
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
    ep.ativo,
    p.created_at
FROM projetos p
LEFT JOIN engenheiros_projetos ep ON ep.projeto_id = p.projeto_id
LEFT JOIN engenheiros e ON e.eng_id = ep.eng_id
LEFT JOIN areas a ON a.area_id = ep.area_id
LEFT JOIN status_bd s ON s.status_id = ep.status_id
WHERE p.ativo = true
ORDER BY p.created_at DESC;

-- Teste a view
SELECT * FROM vw_projetos_detalhado LIMIT 5;
