-- Inserir uma tarefa de teste para o Engenheiro 4
-- Execute isso no Supabase SQL Editor

INSERT INTO engenheiros_projetos (
  eng_id,
  projeto_id,
  area_id,
  data_inicio,
  data_prevista,
  status_id,
  percentual_andamento,
  tempo_trabalho_dias,
  observacoes,
  ativo
)
SELECT 
  '332d9213-957d-4d3e-9cf9-77370dd525e1'::uuid, -- Engenheiro 4
  projeto_id,
  area_id,
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '30 days',
  (SELECT status_id FROM status_codes WHERE codigo = 'AGUARDANDO_INICIO' LIMIT 1),
  0,
  30,
  'Tarefa de teste para validar fluxo do engenheiro',
  true
FROM projetos
CROSS JOIN areas
WHERE projetos.codigo_projeto = 'PRJ-003'
  AND areas.codigo = 'CANT_OBRA_DRT'
LIMIT 1
ON CONFLICT (eng_id, projeto_id, area_id) DO NOTHING;

-- Verificar se foi inserido
SELECT ep.id, p.codigo_projeto, p.cliente, a.nome as area
FROM engenheiros_projetos ep
JOIN projetos p ON p.projeto_id = ep.projeto_id
JOIN areas a ON a.area_id = ep.area_id
WHERE ep.eng_id = '332d9213-957d-4d3e-9cf9-77370dd525e1';

