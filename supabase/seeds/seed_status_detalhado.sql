-- =====================================================
-- SEED COMPLETO - STATUS DOS PROJETOS
-- Baseado na planilha de workflow real
-- =====================================================

-- =====================================================
-- STATUS PRINCIPAIS DO WORKFLOW
-- Usa ON CONFLICT para atualizar sem apagar dados existentes
-- =====================================================

INSERT INTO status_codes (codigo, descricao, ordem, percentual_base, ativo) VALUES
('AGUARDANDO_INICIO', 'Aguardando Início', 1, 0.00, true)
ON CONFLICT (codigo) DO UPDATE SET
    descricao = EXCLUDED.descricao,
    ordem = EXCLUDED.ordem,
    percentual_base = EXCLUDED.percentual_base,
    ativo = EXCLUDED.ativo;

INSERT INTO status_codes (codigo, descricao, ordem, percentual_base, ativo) VALUES
('EM_EXECUCAO', 'Em Execução', 2, 50.00, true)
ON CONFLICT (codigo) DO UPDATE SET
    descricao = EXCLUDED.descricao,
    ordem = EXCLUDED.ordem,
    percentual_base = EXCLUDED.percentual_base,
    ativo = EXCLUDED.ativo;

INSERT INTO status_codes (codigo, descricao, ordem, percentual_base, ativo) VALUES
('PARADO_CLIENTE', 'Parado Cliente', 3, 50.00, true)
ON CONFLICT (codigo) DO UPDATE SET
    descricao = EXCLUDED.descricao,
    ordem = EXCLUDED.ordem,
    percentual_base = EXCLUDED.percentual_base,
    ativo = EXCLUDED.ativo;

INSERT INTO status_codes (codigo, descricao, ordem, percentual_base, ativo) VALUES
('PARADO_TECPRED', 'Parado TecPred', 4, 50.00, true)
ON CONFLICT (codigo) DO UPDATE SET
    descricao = EXCLUDED.descricao,
    ordem = EXCLUDED.ordem,
    percentual_base = EXCLUDED.percentual_base,
    ativo = EXCLUDED.ativo;

INSERT INTO status_codes (codigo, descricao, ordem, percentual_base, ativo) VALUES
('AGUARDANDO_INF_CLIENTE', 'Aguardando Inf. Cliente', 5, 60.00, true)
ON CONFLICT (codigo) DO UPDATE SET
    descricao = EXCLUDED.descricao,
    ordem = EXCLUDED.ordem,
    percentual_base = EXCLUDED.percentual_base,
    ativo = EXCLUDED.ativo;

INSERT INTO status_codes (codigo, descricao, ordem, percentual_base, ativo) VALUES
('EM_APROVACAO', 'Em Aprovação', 6, 75.00, true)
ON CONFLICT (codigo) DO UPDATE SET
    descricao = EXCLUDED.descricao,
    ordem = EXCLUDED.ordem,
    percentual_base = EXCLUDED.percentual_base,
    ativo = EXCLUDED.ativo;

INSERT INTO status_codes (codigo, descricao, ordem, percentual_base, ativo) VALUES
('CONCLUIDO', 'Concluído', 7, 100.00, true)
ON CONFLICT (codigo) DO UPDATE SET
    descricao = EXCLUDED.descricao,
    ordem = EXCLUDED.ordem,
    percentual_base = EXCLUDED.percentual_base,
    ativo = EXCLUDED.ativo;

-- =====================================================
-- TABELA: status_detalhamento
-- Detalhamento de atividades por status
-- =====================================================

CREATE TABLE IF NOT EXISTS status_detalhamento (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    status_codigo TEXT NOT NULL,
    tipo TEXT NOT NULL, -- 'PREVISAO' ou 'FEITO' ou 'SIGNIFICADO'
    descricao TEXT NOT NULL,
    ordem INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(status_codigo, tipo, descricao)
);

CREATE INDEX IF NOT EXISTS idx_status_det_codigo ON status_detalhamento(status_codigo);
CREATE INDEX IF NOT EXISTS idx_status_det_tipo ON status_detalhamento(tipo);

COMMENT ON TABLE status_detalhamento IS 'Detalhamento de atividades típicas por status (previsão/feito)';

-- =====================================================
-- AGUARDANDO INÍCIO
-- =====================================================

INSERT INTO status_detalhamento (status_codigo, tipo, descricao, ordem) VALUES
('AGUARDANDO_INICIO', 'PREVISAO', 'Revisão de documentação enviada pelo cliente', 1),
('AGUARDANDO_INICIO', 'FEITO', 'Aguardando Início', 1),
('AGUARDANDO_INICIO', 'FEITO', 'Checklist inicial concluído', 2),
('AGUARDANDO_INICIO', 'SIGNIFICADO', 'Projeto recebido, esperando documentação, reunião ou liberação', 1)
ON CONFLICT (status_codigo, tipo, descricao) DO NOTHING;

-- =====================================================
-- EM EXECUÇÃO
-- =====================================================

-- Previsões típicas para Em Execução
INSERT INTO status_detalhamento (status_codigo, tipo, descricao, ordem) VALUES
('EM_EXECUCAO', 'PREVISAO', 'Solicitar planta baixa/arquitetônico', 1),
('EM_EXECUCAO', 'PREVISAO', 'Checar compatibilização com disciplinas', 2),
('EM_EXECUCAO', 'PREVISAO', 'Preparar checklist de requisitos técnicos', 3),
('EM_EXECUCAO', 'PREVISAO', 'Confirmar horário com o cliente', 4),
('EM_EXECUCAO', 'PREVISAO', 'Organizar arquivos e criar pasta do projeto', 5),
('EM_EXECUCAO', 'PREVISAO', 'Realizar pré-dimensionamento', 6),
('EM_EXECUCAO', 'PREVISAO', 'Realizar traçado preliminar', 7),
('EM_EXECUCAO', 'PREVISAO', 'Dimensionar ramais principais', 8),
('EM_EXECUCAO', 'PREVISAO', 'Dimensionar quadros/painéis/coletores', 9),
('EM_EXECUCAO', 'PREVISAO', 'Executar levantamento de cargas', 10),
('EM_EXECUCAO', 'PREVISAO', 'Gerar prancha de lançamento', 11),
('EM_EXECUCAO', 'PREVISAO', 'Realizar detalhamento final', 12),
('EM_EXECUCAO', 'PREVISAO', 'Conferir normas e requisitos', 13),
('EM_EXECUCAO', 'PREVISAO', 'Cumprir 50% do detalhamento', 14),
('EM_EXECUCAO', 'PREVISAO', 'Finalizar detalhamento', 15),
('EM_EXECUCAO', 'PREVISAO', 'Ajustar compatibilização com área elétrica/hidráulica', 16)
ON CONFLICT (status_codigo, tipo, descricao) DO NOTHING;

-- Feitos típicos para Em Execução
INSERT INTO status_detalhamento (status_codigo, tipo, descricao, ordem) VALUES
('EM_EXECUCAO', 'FEITO', 'Documentação solicitada ao cliente', 1),
('EM_EXECUCAO', 'FEITO', 'Arquitetônico/técnico tramitado', 2),
('EM_EXECUCAO', 'FEITO', 'Pasta do projeto criada e organizada', 3),
('EM_EXECUCAO', 'FEITO', 'Pré-dimensionamento finalizado', 4),
('EM_EXECUCAO', 'FEITO', 'Traçado preliminar concluído', 5),
('EM_EXECUCAO', 'FEITO', 'Dimensionamento de ramais principais concluído', 6),
('EM_EXECUCAO', 'FEITO', 'Prancha X finalizada', 7),
('EM_EXECUCAO', 'FEITO', 'Revisão interna atendida', 8),
('EM_EXECUCAO', 'FEITO', 'Compatibilização concluída', 9),
('EM_EXECUCAO', 'FEITO', 'Detalhamento 70% executado', 10),
('EM_EXECUCAO', 'FEITO', 'Cálculo de carga concluído', 11),
('EM_EXECUCAO', 'FEITO', 'Revisões internas aplicadas', 12)
ON CONFLICT (status_codigo, tipo, descricao) DO NOTHING;

INSERT INTO status_detalhamento (status_codigo, tipo, descricao, ordem) VALUES
('EM_EXECUCAO', 'SIGNIFICADO', 'Engenheiro está trabalhando ativamente no dimensionamento, traçado, pré-projeto ou detalhamento', 1)
ON CONFLICT (status_codigo, tipo, descricao) DO NOTHING;

-- =====================================================
-- PARADO CLIENTE
-- =====================================================

INSERT INTO status_detalhamento (status_codigo, tipo, descricao, ordem) VALUES
('PARADO_CLIENTE', 'PREVISAO', 'Preparar material para revisão interna', 1),
('PARADO_CLIENTE', 'PREVISAO', 'Revisar desvios encontrados no projeto', 2),
('PARADO_CLIENTE', 'PREVISAO', 'Enviar projeto revisado ao cliente', 3),
('PARADO_CLIENTE', 'PREVISAO', 'Responder observações pendentes do cliente', 4),
('PARADO_CLIENTE', 'PREVISAO', 'Realizar pequenas correções antes do envio', 5),
('PARADO_CLIENTE', 'PREVISAO', 'Registrar pendências do cliente para controle', 6),
('PARADO_CLIENTE', 'PREVISAO', 'Acompanhar retorno do cliente até 17h', 7),
('PARADO_CLIENTE', 'PREVISAO', 'Cobrar documentação pendente', 8),
('PARADO_CLIENTE', 'PREVISAO', 'Atualizar planilha com pendências do cliente', 9),
('PARADO_CLIENTE', 'PREVISAO', 'Enviar e-mail formal de solicitação de informações', 10),
('PARADO_CLIENTE', 'PREVISAO', 'Preparar relatório de pendências técnicas', 11),
('PARADO_CLIENTE', 'PREVISAO', 'Aguardar retorno da revisão do cliente', 12)
ON CONFLICT (status_codigo, tipo, descricao) DO NOTHING;

INSERT INTO status_detalhamento (status_codigo, tipo, descricao, ordem) VALUES
('PARADO_CLIENTE', 'FEITO', 'Ajustes solicitados pelo cliente aplicados', 1),
('PARADO_CLIENTE', 'FEITO', 'Projeto reenviado para análise', 2),
('PARADO_CLIENTE', 'FEITO', 'Checklist de pendências atualizado', 3),
('PARADO_CLIENTE', 'FEITO', 'Checklist de revisão preenchido', 4),
('PARADO_CLIENTE', 'FEITO', 'E-mail de cobrança enviado', 5),
('PARADO_CLIENTE', 'FEITO', 'Contato telefônico realizado', 6),
('PARADO_CLIENTE', 'FEITO', 'Aguardando envio de plantas corrigidas', 7),
('PARADO_CLIENTE', 'FEITO', 'Cliente confirmou retorno para amanhã', 8),
('PARADO_CLIENTE', 'FEITO', 'Arquivos enviados ao cliente', 9),
('PARADO_CLIENTE', 'FEITO', 'Projeto arquivado', 10),
('PARADO_CLIENTE', 'FEITO', 'Checklist final concluído', 11)
ON CONFLICT (status_codigo, tipo, descricao) DO NOTHING;

INSERT INTO status_detalhamento (status_codigo, tipo, descricao, ordem) VALUES
('PARADO_CLIENTE', 'SIGNIFICADO', 'Aguarda informações, revisões ou decisões do cliente', 1)
ON CONFLICT (status_codigo, tipo, descricao) DO NOTHING;

-- =====================================================
-- PARADO TECPRED
-- =====================================================

INSERT INTO status_detalhamento (status_codigo, tipo, descricao, ordem) VALUES
('PARADO_TECPRED', 'PREVISAO', 'Aguardar decisão interna', 1),
('PARADO_TECPRED', 'PREVISAO', 'Aguardar retorno do Chefe', 2),
('PARADO_TECPRED', 'PREVISAO', 'Analisar documentos e diagramas internos', 3),
('PARADO_TECPRED', 'PREVISAO', 'Preparar justificativa técnica para decisão', 4),
('PARADO_TECPRED', 'PREVISAO', 'Registrar motivo da pausa', 5)
ON CONFLICT (status_codigo, tipo, descricao) DO NOTHING;

INSERT INTO status_detalhamento (status_codigo, tipo, descricao, ordem) VALUES
('PARADO_TECPRED', 'FEITO', 'Aguardando validação do Engenheiro Chefe', 1),
('PARADO_TECPRED', 'FEITO', 'Projeto revisado internamente, aguardando decisão', 2),
('PARADO_TECPRED', 'FEITO', 'Pauta da reunião interna organizada', 3)
ON CONFLICT (status_codigo, tipo, descricao) DO NOTHING;

INSERT INTO status_detalhamento (status_codigo, tipo, descricao, ordem) VALUES
('PARADO_TECPRED', 'SIGNIFICADO', 'Aguarda decisão interna, aprovação técnica ou redistribuição. Similar ao anterior, mas mais específico: falta documentação', 1)
ON CONFLICT (status_codigo, tipo, descricao) DO NOTHING;

-- =====================================================
-- AGUARDANDO INF. CLIENTE
-- =====================================================

INSERT INTO status_detalhamento (status_codigo, tipo, descricao, ordem) VALUES
('AGUARDANDO_INF_CLIENTE', 'SIGNIFICADO', 'Aguarda informações, revisões ou decisões do cliente', 1)
ON CONFLICT (status_codigo, tipo, descricao) DO NOTHING;

-- =====================================================
-- EM APROVAÇÃO
-- =====================================================

INSERT INTO status_detalhamento (status_codigo, tipo, descricao, ordem) VALUES
('EM_APROVACAO', 'PREVISAO', 'Conferir normas e requisitos', 1),
('EM_APROVACAO', 'PREVISAO', 'Cumprir 50% do detalhamento', 2),
('EM_APROVACAO', 'PREVISAO', 'Finalizar detalhamento', 3)
ON CONFLICT (status_codigo, tipo, descricao) DO NOTHING;

INSERT INTO status_detalhamento (status_codigo, tipo, descricao, ordem) VALUES
('EM_APROVACAO', 'FEITO', 'Ajustes solicitados pelo cliente aplicados', 1),
('EM_APROVACAO', 'FEITO', 'Projeto reenviado para análise', 2),
('EM_APROVACAO', 'FEITO', 'Checklist de pendências atualizado', 3),
('EM_APROVACAO', 'FEITO', 'Checklist de revisão preenchido', 4)
ON CONFLICT (status_codigo, tipo, descricao) DO NOTHING;

INSERT INTO status_detalhamento (status_codigo, tipo, descricao, ordem) VALUES
('EM_APROVACAO', 'SIGNIFICADO', 'Para Aprovação significa que está responsável; aguardando retorno', 1)
ON CONFLICT (status_codigo, tipo, descricao) DO NOTHING;

-- =====================================================
-- CONCLUÍDO
-- =====================================================

INSERT INTO status_detalhamento (status_codigo, tipo, descricao, ordem) VALUES
('CONCLUIDO', 'PREVISAO', 'Enviar arquivos finais', 1),
('CONCLUIDO', 'PREVISAO', 'Organizar arquivos para arquivamento', 2),
('CONCLUIDO', 'PREVISAO', 'Gerar versão final das pranchas', 3),
('CONCLUIDO', 'PREVISAO', 'Subir documentação pro portal', 4)
ON CONFLICT (status_codigo, tipo, descricao) DO NOTHING;

INSERT INTO status_detalhamento (status_codigo, tipo, descricao, ordem) VALUES
('CONCLUIDO', 'FEITO', 'Finalizado e entregue', 1),
('CONCLUIDO', 'FEITO', 'Arquivos enviados ao cliente', 2),
('CONCLUIDO', 'FEITO', 'Projeto arquivado', 3),
('CONCLUIDO', 'FEITO', 'Checklist final concluído', 4)
ON CONFLICT (status_codigo, tipo, descricao) DO NOTHING;

INSERT INTO status_detalhamento (status_codigo, tipo, descricao, ordem) VALUES
('CONCLUIDO', 'SIGNIFICADO', 'Finalizado e entregue', 1)
ON CONFLICT (status_codigo, tipo, descricao) DO NOTHING;

-- =====================================================
-- VIEW: Sugestões de Previsão por Status
-- =====================================================

CREATE OR REPLACE VIEW vw_sugestoes_previsao AS
SELECT 
    status_codigo,
    descricao AS sugestao_previsao
FROM status_detalhamento
WHERE tipo = 'PREVISAO'
ORDER BY status_codigo, ordem;

COMMENT ON VIEW vw_sugestoes_previsao IS 'Sugestões de atividades para "previsão do dia" por status';

-- =====================================================
-- VIEW: Sugestões de Feito por Status
-- =====================================================

CREATE OR REPLACE VIEW vw_sugestoes_feito AS
SELECT 
    status_codigo,
    descricao AS sugestao_feito
FROM status_detalhamento
WHERE tipo = 'FEITO'
ORDER BY status_codigo, ordem;

COMMENT ON VIEW vw_sugestoes_feito IS 'Sugestões de atividades para "feito ao fim do dia" por status';

-- =====================================================
-- VIEW: Significado dos Status
-- =====================================================

CREATE OR REPLACE VIEW vw_significado_status AS
SELECT 
    sc.codigo AS status_codigo,
    sc.descricao AS status_nome,
    sc.percentual_base,
    sd.descricao AS significado
FROM status_codes sc
LEFT JOIN status_detalhamento sd ON sd.status_codigo = sc.codigo AND sd.tipo = 'SIGNIFICADO'
ORDER BY sc.ordem;

COMMENT ON VIEW vw_significado_status IS 'Significado e contexto de cada status';

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================

SELECT 
    '📊 Status cadastrados:' AS info,
    COUNT(*) AS total
FROM status_codes;

SELECT 
    '📋 Detalhamentos cadastrados:' AS info,
    COUNT(*) AS total
FROM status_detalhamento;

SELECT 
    status_codigo,
    COUNT(*) FILTER (WHERE tipo = 'PREVISAO') AS qtd_previsoes,
    COUNT(*) FILTER (WHERE tipo = 'FEITO') AS qtd_feitos,
    COUNT(*) FILTER (WHERE tipo = 'SIGNIFICADO') AS tem_significado
FROM status_detalhamento
GROUP BY status_codigo
ORDER BY status_codigo;

/*
RESULTADO ESPERADO:
- 7 status principais
- ~80 detalhamentos (previsões + feitos + significados)
- Cada status com múltiplas sugestões de atividades
*/




