-- =====================================================
-- Observacoes do engenheiro e relato diario
-- =====================================================
--
-- Dois problemas distintos que convergem no mesmo campo do dashboard:
--
-- 1. engenheiros_projetos.observacoes nasce preenchida com 'Atribuido por: <dono|Sistema>',
--    gravada pelo trigger sincronizar_task_para_engenheiro(). A view vw_projetos_detalhado
--    expoe essa coluna como motivo_aguardo e o modal a rotula "Observacoes do Engenheiro".
--    Resultado: 246 das 297 atribuicoes exibiam metadado administrativo como se fosse fala
--    do engenheiro. O carimbo passa a ter coluna propria.
--
-- 2. projetos_previsao.previsao_texto era NOT NULL, mas o upsert da notificacao noturna
--    (atualizarFeitoDia) nao passa esse campo. Toda noite sem notificacao matinal no mesmo
--    dia o INSERT violava a constraint, o erro era engolido como warning e o relato do dia
--    era descartado: 203 registros na tabela, 1 unico com feito_texto, contra 393
--    apontamentos noturnos em retrabalho_projetos no mesmo periodo.
--
-- Aplicar manualmente no SQL editor do Supabase.

-- =====================================================
-- PARTE 1: o carimbo de atribuicao sai de observacoes
-- =====================================================

ALTER TABLE engenheiros_projetos
    ADD COLUMN IF NOT EXISTS atribuido_por TEXT;

COMMENT ON COLUMN engenheiros_projetos.atribuido_por IS
    'Quem atribuiu a disciplina. Preenchido pelo trigger de sincronizacao; antes era gravado dentro de observacoes.';

COMMENT ON COLUMN engenheiros_projetos.observacoes IS
    'Observacao escrita pelo engenheiro no chatbot. Nao usar para metadado do sistema.';

-- Backfill nao destrutivo: copia antes de limpar. As duas grafias existem no historico
-- ('Atribuido por: ' nas migrations recentes, 'Atribuído por: ' nas antigas).
UPDATE engenheiros_projetos
SET atribuido_por = observacoes,
    observacoes = NULL
WHERE observacoes ~* '^Atribu[ií]do por:';

-- Funcao recriada a partir de 20260729_complemento_instancias.sql:129-192.
-- Unica diferenca: o carimbo vai para atribuido_por e observacoes nasce NULL.
CREATE OR REPLACE FUNCTION sincronizar_task_para_engenheiro()
RETURNS TRIGGER AS $$
DECLARE
    v_projeto_id UUID;
    v_eng_projeto_id UUID;
    v_status_id INTEGER;
BEGIN
    IF NEW.sincronizado = false THEN
        IF NEW.projeto_id IS NULL AND NEW.codigo_projeto IS NOT NULL THEN
            INSERT INTO projetos (codigo_projeto, cliente)
            VALUES (NEW.codigo_projeto, NEW.cliente)
            ON CONFLICT (codigo_projeto) DO NOTHING
            RETURNING projeto_id INTO v_projeto_id;

            IF v_projeto_id IS NULL THEN
                SELECT projeto_id INTO v_projeto_id
                FROM projetos
                WHERE codigo_projeto = NEW.codigo_projeto
                LIMIT 1;
            END IF;

            NEW.projeto_id := v_projeto_id;
        ELSE
            v_projeto_id := NEW.projeto_id;
        END IF;

        SELECT status_id INTO v_status_id
        FROM status_codes
        WHERE codigo = 'AGUARDANDO_INICIO'
        LIMIT 1;

        INSERT INTO engenheiros_projetos (
            eng_id,
            projeto_id,
            area_id,
            instancia_label,
            complemento_area_ref_id,
            data_inicio,
            data_prevista,
            status_id,
            atribuido_por
        ) VALUES (
            NEW.eng_id,
            v_projeto_id,
            NEW.area_id,
            NEW.instancia_label,
            NEW.complemento_area_ref_id,
            COALESCE(NEW.data_inicio_prevista, CURRENT_DATE),
            NEW.data_conclusao_prevista,
            v_status_id,
            'Atribuido por: ' || COALESCE(
                (SELECT nome FROM dono_empresa WHERE dono_id = NEW.dono_id),
                'Sistema'
            )
        ) RETURNING id, instancia_label, complemento_area_ref_id
        INTO v_eng_projeto_id, NEW.instancia_label, NEW.complemento_area_ref_id;

        NEW.eng_projeto_id := v_eng_projeto_id;
        NEW.sincronizado := true;
        NEW.data_sincronizacao := NOW();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PARTE 2: o relato do dia para de se perder
-- =====================================================

-- Registrar a noite sem ter registrado a manha e um caso legitimo do fluxo do chatbot,
-- e justamente o mais comum. Preencher previsao_texto com um placeholder sintetico
-- reproduziria em projetos_previsao o problema que a Parte 1 corrige em observacoes.
ALTER TABLE projetos_previsao
    ALTER COLUMN previsao_texto DROP NOT NULL;

-- =====================================================
-- PARTE 3: views
-- =====================================================

-- Recriada a partir de 20260703_dashboard_atribuicoes_transferir_excluir.sql:253-287,
-- com atribuido_por acrescentado. motivo_aguardo continua sendo ep.observacoes — agora
-- contendo so o que o engenheiro escreveu.
DROP VIEW IF EXISTS vw_projetos_detalhado;
CREATE VIEW vw_projetos_detalhado AS
SELECT
    ep.id AS atribuicao_id,
    ep.eng_id,
    ep.area_id,
    p.projeto_id,
    p.codigo_projeto,
    COALESCE(p.cliente, 'Sem cliente') AS cliente,
    p.descricao,
    COALESCE(e.nome, 'Sem engenheiro') AS engenheiro_nome,
    a.codigo AS area_codigo,
    COALESCE(a.descricao, 'Sem area') AS area_descricao,
    ep.instancia_label,
    CASE
        WHEN COALESCE(ep.percentual_ponderado, 0) >= 100 THEN 'Concluido'
        WHEN COALESCE(ep.percentual_ponderado, 0) > 0 THEN 'Em Andamento'
        ELSE 'Aguardando Inicio'
    END AS status_descricao,
    COALESCE(ep.percentual_ponderado, 0) AS percentual_andamento,
    ep.data_inicio,
    ep.data_prevista,
    ep.data_conclusao,
    CASE
        WHEN ep.data_prevista::DATE < CURRENT_DATE AND COALESCE(ep.percentual_ponderado, 0) < 100
        THEN (CURRENT_DATE - ep.data_prevista::DATE)
        ELSE 0
    END AS dias_atraso,
    ep.observacoes AS motivo_aguardo,
    ep.atribuido_por,
    p.ativo,
    p.created_at
FROM projetos p
LEFT JOIN engenheiros_projetos ep ON ep.projeto_id = p.projeto_id AND ep.ativo = true
LEFT JOIN engenheiros e ON e.eng_id = ep.eng_id
LEFT JOIN areas a ON a.area_id = ep.area_id
WHERE p.ativo = true;

-- O dashboard usa a chave anon, que nao enxerga tabelas-base. O relato diario so chega
-- a tela atraves de uma view.
-- eng_id e projeto_id vem de engenheiros_projetos, nao das colunas duplicadas em
-- projetos_previsao: transferir_atribuicao troca ep.eng_id sem tocar nos apontamentos, entao
-- pp.eng_id fica desatualizado apos qualquer transferencia. Mesma razao do
-- 20260901_fix_dashboard_producao_apontamentos_assignment_join.sql.
DROP VIEW IF EXISTS vw_atribuicao_apontamentos;
CREATE VIEW vw_atribuicao_apontamentos AS
SELECT
    pp.eng_projeto_id AS atribuicao_id,
    ep.projeto_id,
    ep.eng_id,
    pp.data_registro,
    pp.previsao_texto,
    pp.feito_texto
FROM projetos_previsao pp
JOIN engenheiros_projetos ep ON ep.id = pp.eng_projeto_id
WHERE pp.previsao_texto IS NOT NULL OR pp.feito_texto IS NOT NULL;

COMMENT ON VIEW vw_atribuicao_apontamentos IS
    'Relato diario do engenheiro por atribuicao. Unico caminho do dashboard ate projetos_previsao, que a chave anon nao le.';

GRANT SELECT ON vw_projetos_detalhado TO anon, authenticated;
GRANT SELECT ON vw_atribuicao_apontamentos TO anon, authenticated;
