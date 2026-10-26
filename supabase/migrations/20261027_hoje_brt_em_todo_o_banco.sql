-- =====================================================
-- MIGRACAO: "hoje" no fuso de Brasilia em todo o banco
-- =====================================================
-- CURRENT_DATE no Supabase e o dia em UTC: das 21h a meia-noite de Brasilia
-- ja e o dia seguinte. A 20261023 resolveu isso so no apontamento de horas
-- (registrar_retrabalho_dia, com hoje_brt()). Faltavam 44 usos em 21 objetos:
--
--   - datas de conclusao gravadas por triggers e funcoes
--     (atualizar_progresso_area, auto_preencher_data_conclusao,
--     auto_data_conclusao_etapa, sync_conclusao_por_ponderado,
--     marcar_area_concluida): concluir depois das 21h gravava amanha;
--   - previsoes e relatos (registrar_previsao_dia, atualizar_feito_dia,
--     registrar_retrabalho) e os defaults de projetos_previsao.data_registro e
--     retrabalho_projetos.data_retrabalho;
--   - as views de atraso e de visao geral (vw_bloco2_atrasos_*,
--     vw_grafico_atrasos_engenheiro, vw_dono_*, vw_projetos_*, vw_bloco1):
--     depois das 21h um prazo de hoje ja aparecia como atrasado;
--   - sincronizar_task_para_engenheiro, limpar_projetos_finalizados_antigos e
--     atribuir_area_projeto (esta sem uso, trocada so por consistencia).
--
-- Cada objeto e recriado com a definicao EXATA do baseline de 26/10/2026,
-- trocando apenas CURRENT_DATE por public.hoje_brt() (gerado por script, sem
-- edicao manual). Permissoes e dependencias se mantem (CREATE OR REPLACE).
--
-- Nao altera nem apaga dado nenhum. Registros antigos ficam como estao.
-- Conferir: a consulta do fim deve voltar zero linhas.
-- Desfazer: supabase/rollbacks/20261027_hoje_brt_em_todo_o_banco.rollback.sql
-- =====================================================

BEGIN;

-- Aborta se hoje_brt() nao existir (criada pela 20261023).
SELECT 'public.hoje_brt()'::regprocedure;

-- default: projetos_previsao.data_registro
ALTER TABLE public.projetos_previsao ALTER COLUMN data_registro SET DEFAULT public.hoje_brt();

-- default: retrabalho_projetos.data_retrabalho
ALTER TABLE public.retrabalho_projetos ALTER COLUMN data_retrabalho SET DEFAULT public.hoje_brt();

-- funcao: atribuir_area_projeto(uuid,uuid,text,date,date,text)
CREATE OR REPLACE FUNCTION public.atribuir_area_projeto(p_eng_id uuid, p_projeto_id uuid, p_area_codigo text, p_data_inicio date DEFAULT public.hoje_brt(), p_data_prevista date DEFAULT NULL::date, p_status_codigo text DEFAULT 'AGUARDANDO_INICIO'::text)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_area_id INTEGER;
    v_status_id INTEGER;
    v_atribuicao_id UUID;
    v_tempo_trabalho INTEGER;
    v_percentual NUMERIC;
BEGIN
    -- Valida engenheiro
    IF NOT EXISTS (SELECT 1 FROM engenheiros WHERE eng_id = p_eng_id AND ativo = true) THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Engenheiro não encontrado'
        );
    END IF;
    
    -- Valida projeto
    IF NOT EXISTS (SELECT 1 FROM projetos WHERE projeto_id = p_projeto_id AND ativo = true) THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Projeto não encontrado'
        );
    END IF;
    
    -- Busca área
    SELECT area_id INTO v_area_id
    FROM areas 
    WHERE UPPER(codigo) = UPPER(TRIM(p_area_codigo)) AND ativo = true;
    
    IF v_area_id IS NULL THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Área não encontrada. Áreas disponíveis: ELETRICO, HIDRAULICO, ESTRUTURAL, etc.'
        );
    END IF;
    
    -- Busca status
    SELECT status_id INTO v_status_id
    FROM status_codes
    WHERE UPPER(codigo) = UPPER(TRIM(p_status_codigo)) AND ativo = true;
    
    IF v_status_id IS NULL THEN
        v_status_id := (SELECT status_id FROM status_codes WHERE codigo = 'AGUARDANDO_INICIO');
    END IF;
    
    -- Verifica duplicidade
    IF EXISTS (
        SELECT 1 FROM engenheiros_projetos 
        WHERE eng_id = p_eng_id 
        AND projeto_id = p_projeto_id 
        AND area_id = v_area_id 
        AND ativo = true
    ) THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Engenheiro já está atribuído a esta área neste projeto'
        );
    END IF;
    
    -- Insere atribuição (triggers calculam tempo e percentual automaticamente)
    INSERT INTO engenheiros_projetos (
        eng_id, 
        projeto_id, 
        area_id, 
        data_inicio, 
        data_prevista,
        status_id
    ) VALUES (
        p_eng_id,
        p_projeto_id,
        v_area_id,
        COALESCE(p_data_inicio, public.hoje_brt()),
        p_data_prevista,
        v_status_id
    ) RETURNING id, tempo_trabalho_dias, percentual_andamento 
    INTO v_atribuicao_id, v_tempo_trabalho, v_percentual;
    
    RETURN json_build_object(
        'sucesso', true,
        'mensagem', 'Área atribuída com sucesso! Tempo e percentual calculados automaticamente.',
        'atribuicao_id', v_atribuicao_id,
        'tempo_trabalho_dias', v_tempo_trabalho,
        'percentual_andamento', v_percentual
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'sucesso', false,
        'mensagem', 'Erro ao atribuir área: ' || SQLERRM
    );
END;
$function$
;

-- funcao: registrar_retrabalho(uuid,text,text)
CREATE OR REPLACE FUNCTION public.registrar_retrabalho(p_atribuicao_id uuid, p_motivo text, p_descricao text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_retrabalho_id UUID;
BEGIN
    INSERT INTO retrabalho_projetos (
        eng_projeto_id,
        necessitou_retrabalho,
        motivo,
        descricao,
        data_retrabalho
    ) VALUES (
        p_atribuicao_id,
        true,
        p_motivo,
        p_descricao,
        public.hoje_brt()
    ) RETURNING id INTO v_retrabalho_id;
    
    RETURN json_build_object(
        'sucesso', true,
        'mensagem', 'Retrabalho registrado',
        'retrabalho_id', v_retrabalho_id
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'sucesso', false,
        'mensagem', 'Erro ao registrar retrabalho: ' || SQLERRM
    );
END;
$function$
;

-- funcao: registrar_previsao_dia(uuid,text,integer,date)
CREATE OR REPLACE FUNCTION public.registrar_previsao_dia(p_atribuicao_id uuid, p_previsao_texto text, p_tempo_estimado integer DEFAULT NULL::integer, p_nova_data_prevista date DEFAULT NULL::date)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_previsao_id UUID;
    v_projeto_id UUID;
    v_eng_id UUID;
    v_status_id INTEGER;
    v_previsao_existente UUID;
BEGIN
    -- Valida atribuição
    IF NOT EXISTS (SELECT 1 FROM engenheiros_projetos WHERE id = p_atribuicao_id AND ativo = true) THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Atribuição não encontrada'
        );
    END IF;
    
    -- Busca dados da atribuição
    SELECT projeto_id, eng_id, status_id
    INTO v_projeto_id, v_eng_id, v_status_id
    FROM engenheiros_projetos
    WHERE id = p_atribuicao_id;
    
    -- Verifica se já existe previsão para hoje
    SELECT id INTO v_previsao_existente
    FROM projetos_previsao 
    WHERE eng_projeto_id = p_atribuicao_id 
    AND data_registro = public.hoje_brt()
    LIMIT 1;
    
    -- Se já existe, ATUALIZA
    IF v_previsao_existente IS NOT NULL THEN
        UPDATE projetos_previsao
        SET 
            previsao_texto = p_previsao_texto,
            tempo_estimado = COALESCE(p_tempo_estimado, tempo_estimado),
            nova_data_prevista = COALESCE(p_nova_data_prevista, nova_data_prevista),
            status_id = v_status_id,
            updated_at = NOW()
        WHERE id = v_previsao_existente
        RETURNING id INTO v_previsao_id;
        
        RETURN json_build_object(
            'sucesso', true,
            'mensagem', 'Previsão atualizada',
            'previsao_id', v_previsao_id,
            'data', public.hoje_brt()
        );
    END IF;
    
    -- Se não existe, INSERE
    INSERT INTO projetos_previsao (
        eng_projeto_id,
        projeto_id,
        eng_id,
        data_registro,
        previsao_texto,
        tempo_estimado,
        nova_data_prevista,
        status_id,
        editavel
    ) VALUES (
        p_atribuicao_id,
        v_projeto_id,
        v_eng_id,
        public.hoje_brt(),
        p_previsao_texto,
        p_tempo_estimado,
        p_nova_data_prevista,
        v_status_id,
        true
    )
    RETURNING id INTO v_previsao_id;
    
    -- Atualiza data prevista se fornecida
    IF p_nova_data_prevista IS NOT NULL THEN
        UPDATE engenheiros_projetos
        SET 
            data_prevista = p_nova_data_prevista,
            updated_at = NOW()
        WHERE id = p_atribuicao_id;
    END IF;
    
    RETURN json_build_object(
        'sucesso', true,
        'mensagem', 'Previsão registrada',
        'previsao_id', v_previsao_id,
        'data', public.hoje_brt()
    );
END;
$function$
;

-- funcao: atualizar_feito_dia(uuid,text,date)
CREATE OR REPLACE FUNCTION public.atualizar_feito_dia(p_atribuicao_id uuid, p_feito_texto text, p_nova_data_prevista date DEFAULT NULL::date)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_previsao_id UUID;
BEGIN
    -- Busca previsão de hoje
    SELECT id INTO v_previsao_id
    FROM projetos_previsao
    WHERE eng_projeto_id = p_atribuicao_id
    AND data_registro = public.hoje_brt()
    AND editavel = true;
    
    IF v_previsao_id IS NULL THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Não há previsão para hoje ou ela já foi finalizada'
        );
    END IF;
    
    -- Atualiza feito e nova data prevista (trigger tornará imutável)
    UPDATE projetos_previsao
    SET 
        feito_texto = p_feito_texto,
        nova_data_prevista = COALESCE(p_nova_data_prevista, nova_data_prevista)
    WHERE id = v_previsao_id;
    
    -- Atualiza data prevista na atribuição se fornecida
    IF p_nova_data_prevista IS NOT NULL THEN
        UPDATE engenheiros_projetos
        SET data_prevista = p_nova_data_prevista
        WHERE id = p_atribuicao_id;
    END IF;
    
    RETURN json_build_object(
        'sucesso', true,
        'mensagem', 'Feito do dia registrado! Registro agora é imutável.',
        'previsao_id', v_previsao_id,
        'nova_data_prevista', p_nova_data_prevista
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'sucesso', false,
        'mensagem', 'Erro ao atualizar feito: ' || SQLERRM
    );
END;
$function$
;

-- funcao: sincronizar_task_para_engenheiro()
CREATE OR REPLACE FUNCTION public.sincronizar_task_para_engenheiro()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
            COALESCE(NEW.data_inicio_prevista, public.hoje_brt()),
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
$function$
;

-- funcao: auto_preencher_data_conclusao()
CREATE OR REPLACE FUNCTION public.auto_preencher_data_conclusao()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_status_codigo TEXT;
BEGIN
    -- Busca o código do status
    SELECT codigo INTO v_status_codigo
    FROM status_codes
    WHERE status_id = NEW.status_id;
    
    -- Se o status foi alterado para CONCLUIDO e data_conclusao está vazia
    IF v_status_codigo = 'CONCLUIDO' AND NEW.data_conclusao IS NULL THEN
        NEW.data_conclusao := public.hoje_brt();
    END IF;
    
    -- Se o status foi alterado de CONCLUIDO para outro, limpa data_conclusao
    IF v_status_codigo != 'CONCLUIDO' AND OLD.status_id IS NOT NULL THEN
        DECLARE
            v_old_status_codigo TEXT;
        BEGIN
            SELECT codigo INTO v_old_status_codigo
            FROM status_codes
            WHERE status_id = OLD.status_id;
            
            IF v_old_status_codigo = 'CONCLUIDO' THEN
                NEW.data_conclusao := NULL;
            END IF;
        END;
    END IF;
    
    RETURN NEW;
END;
$function$
;

-- funcao: auto_data_conclusao_etapa()
CREATE OR REPLACE FUNCTION public.auto_data_conclusao_etapa()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Preenche data_conclusao ao marcar como concluída
    IF NEW.concluida = true AND (OLD.concluida = false OR OLD.concluida IS NULL) THEN
        NEW.data_conclusao := COALESCE(NEW.data_conclusao, public.hoje_brt());
    END IF;

    -- Limpa data_conclusao ao desmarcar
    IF NEW.concluida = false AND OLD.concluida = true THEN
        NEW.data_conclusao := NULL;
    END IF;

    RETURN NEW;
END;
$function$
;

-- funcao: sync_conclusao_por_ponderado()
CREATE OR REPLACE FUNCTION public.sync_conclusao_por_ponderado()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF COALESCE(NEW.percentual_ponderado, 0) >= 100 THEN
        UPDATE engenheiros_projetos
        SET data_conclusao = COALESCE(data_conclusao, public.hoje_brt()),
            updated_at = CURRENT_TIMESTAMP
        WHERE projeto_id = NEW.projeto_id
          AND ativo = true
          AND data_conclusao IS NULL;
    ELSE
        UPDATE engenheiros_projetos
        SET data_conclusao = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE projeto_id = NEW.projeto_id
          AND ativo = true
          AND data_conclusao IS NOT NULL;
    END IF;
    RETURN NEW;
END;
$function$
;

-- funcao: atualizar_progresso_area()
CREATE OR REPLACE FUNCTION public.atualizar_progresso_area()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_projeto_id UUID;
    v_area_id UUID;
    v_eng_projeto_id UUID;
    v_pct NUMERIC(5,2);
BEGIN
    IF TG_TABLE_NAME = 'pavimento_etapas' THEN
        SELECT pp.projeto_id, pp.area_id, pp.eng_projeto_id
        INTO v_projeto_id, v_area_id, v_eng_projeto_id
        FROM projeto_pavimentos pp
        WHERE pp.pavimento_id = COALESCE(NEW.pavimento_id, OLD.pavimento_id);
    ELSIF TG_TABLE_NAME = 'projeto_etapas_globais' THEN
        v_projeto_id := COALESCE(NEW.projeto_id, OLD.projeto_id);
        v_area_id := COALESCE(NEW.area_id, OLD.area_id);
        v_eng_projeto_id := COALESCE(NEW.eng_projeto_id, OLD.eng_projeto_id);
    ELSIF TG_TABLE_NAME = 'projeto_pavimentos' THEN
        v_projeto_id := COALESCE(NEW.projeto_id, OLD.projeto_id);
        v_area_id := COALESCE(NEW.area_id, OLD.area_id);
        v_eng_projeto_id := COALESCE(NEW.eng_projeto_id, OLD.eng_projeto_id);
    END IF;

    IF v_projeto_id IS NOT NULL AND v_area_id IS NOT NULL THEN
        v_pct := calcular_progresso_area(v_projeto_id, v_area_id, v_eng_projeto_id);

        IF v_eng_projeto_id IS NOT NULL THEN
            UPDATE engenheiros_projetos
            SET percentual_ponderado = v_pct,
                data_conclusao = CASE WHEN v_pct >= 100 THEN COALESCE(data_conclusao, public.hoje_brt()) ELSE NULL END,
                updated_at = CURRENT_TIMESTAMP
            WHERE projeto_id = v_projeto_id
              AND area_id = v_area_id
              AND id = v_eng_projeto_id
              AND ativo = true;
        ELSE
            UPDATE engenheiros_projetos
            SET percentual_ponderado = v_pct,
                data_conclusao = CASE WHEN v_pct >= 100 THEN COALESCE(data_conclusao, public.hoje_brt()) ELSE NULL END,
                updated_at = CURRENT_TIMESTAMP
            WHERE projeto_id = v_projeto_id
              AND area_id = v_area_id
              AND ativo = true;
        END IF;

        PERFORM recalcular_rollup_projeto(v_projeto_id);
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    RETURN NEW;
END;
$function$
;

-- funcao: limpar_projetos_finalizados_antigos(integer,boolean)
CREATE OR REPLACE FUNCTION public.limpar_projetos_finalizados_antigos(p_meses integer DEFAULT 6, p_dry_run boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_data_limite DATE;
    v_projeto_ids UUID[];
    v_candidatos INTEGER;
    v_excluidos INTEGER := 0;
BEGIN
    IF p_meses IS NULL OR p_meses < 1 THEN
        RAISE EXCEPTION 'p_meses deve ser maior ou igual a 1';
    END IF;

    v_data_limite := (public.hoje_brt() - make_interval(months => p_meses))::DATE;

    SELECT COALESCE(array_agg(projeto_id), ARRAY[]::UUID[])
    INTO v_projeto_ids
    FROM (
        SELECT
            p.projeto_id,
            MAX(ep.data_conclusao) AS ultima_conclusao
        FROM projetos p
        JOIN engenheiros_projetos ep
            ON ep.projeto_id = p.projeto_id
           AND ep.ativo = true
        WHERE p.ativo = true
        GROUP BY p.projeto_id
        HAVING
            COUNT(*) > 0
            AND BOOL_AND(COALESCE(ep.percentual_ponderado, 0) >= 100)
            AND MAX(ep.data_conclusao) IS NOT NULL
            AND MAX(ep.data_conclusao)::DATE <= v_data_limite
    ) candidatos;

    v_candidatos := COALESCE(array_length(v_projeto_ids, 1), 0);

    IF p_dry_run OR v_candidatos = 0 THEN
        RETURN jsonb_build_object(
            'dry_run', p_dry_run,
            'meses_retencao', p_meses,
            'data_limite', v_data_limite,
            'projetos_candidatos', v_candidatos,
            'projetos_excluidos', 0
        );
    END IF;

    DELETE FROM notificacoes_whatsapp
    WHERE projeto_id = ANY(v_projeto_ids)
       OR task_id IN (
            SELECT task_id
            FROM evandro_distribuicao_tasks
            WHERE projeto_id = ANY(v_projeto_ids)
       );

    DELETE FROM projetos_previsao
    WHERE projeto_id = ANY(v_projeto_ids);

    DELETE FROM retrabalho_projetos
    WHERE projeto_id = ANY(v_projeto_ids);

    DELETE FROM prazos
    WHERE projeto_id = ANY(v_projeto_ids);

    DELETE FROM evandro_distribuicao_tasks
    WHERE projeto_id = ANY(v_projeto_ids);

    DELETE FROM projeto_etapas_globais
    WHERE projeto_id = ANY(v_projeto_ids);

    DELETE FROM pavimento_etapas
    WHERE pavimento_id IN (
        SELECT pavimento_id
        FROM projeto_pavimentos
        WHERE projeto_id = ANY(v_projeto_ids)
    );

    DELETE FROM projeto_pavimentos
    WHERE projeto_id = ANY(v_projeto_ids);

    DELETE FROM engenheiros_projetos
    WHERE projeto_id = ANY(v_projeto_ids);

    DELETE FROM projetos
    WHERE projeto_id = ANY(v_projeto_ids);

    GET DIAGNOSTICS v_excluidos = ROW_COUNT;

    RETURN jsonb_build_object(
        'dry_run', false,
        'meses_retencao', p_meses,
        'data_limite', v_data_limite,
        'projetos_candidatos', v_candidatos,
        'projetos_excluidos', v_excluidos
    );
END;
$function$
;

-- funcao: marcar_area_concluida(uuid,uuid,boolean,uuid)
CREATE OR REPLACE FUNCTION public.marcar_area_concluida(p_projeto_id uuid, p_area_id uuid, p_concluido boolean DEFAULT true, p_eng_projeto_id uuid DEFAULT NULL::uuid)
 RETURNS numeric
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_pct NUMERIC(5,2);
BEGIN
    v_pct := CASE WHEN p_concluido THEN 100.00 ELSE 0.00 END;

    IF p_eng_projeto_id IS NOT NULL THEN
        UPDATE engenheiros_projetos
        SET percentual_ponderado = v_pct,
            data_conclusao = CASE WHEN p_concluido THEN COALESCE(data_conclusao, public.hoje_brt()) ELSE NULL END,
            updated_at = CURRENT_TIMESTAMP
        WHERE projeto_id = p_projeto_id
          AND area_id = p_area_id
          AND id = p_eng_projeto_id
          AND ativo = true;
    ELSE
        UPDATE engenheiros_projetos
        SET percentual_ponderado = v_pct,
            data_conclusao = CASE WHEN p_concluido THEN COALESCE(data_conclusao, public.hoje_brt()) ELSE NULL END,
            updated_at = CURRENT_TIMESTAMP
        WHERE projeto_id = p_projeto_id
          AND area_id = p_area_id
          AND ativo = true;
    END IF;

    PERFORM recalcular_rollup_projeto(p_projeto_id);
    RETURN v_pct;
END;
$function$
;

-- view: vw_projetos_completo
CREATE OR REPLACE VIEW public.vw_projetos_completo AS
 SELECT ep.id AS atribuicao_id,
    e.eng_id,
    e.nome AS engenheiro_nome,
    p.projeto_id,
    p.codigo_projeto,
    p.cliente,
    a.area_id,
    a.codigo AS area_codigo,
    a.descricao AS area_descricao,
    ep.data_inicio,
    ep.data_prevista,
    ep.data_conclusao,
    ep.status_id,
        CASE
            WHEN COALESCE(ep.percentual_ponderado, 0::numeric) >= 100::numeric THEN 'Concluído'::text
            WHEN COALESCE(ep.percentual_ponderado, 0::numeric) > 0::numeric THEN 'Em Andamento'::text
            ELSE 'Aguardando Início'::text
        END AS status_descricao,
    COALESCE(ep.percentual_ponderado, 0::numeric)::numeric(5,2) AS percentual_andamento,
    ep.tempo_trabalho_dias,
    pr.data_inicio_projeto,
    pr.data_inicio_esperada_cliente,
    pr.prazo_final_eng,
    pr.prazo_final_cliente,
    pr.prazo_interno_dias,
    pr.prazo_cliente_dias,
    COALESCE(vr.quantidade_retrabalhos, 0::bigint) AS quantidade_retrabalhos,
    COALESCE(vr.percentual_retrabalhos, 0::numeric) AS percentual_retrabalhos,
    ( SELECT projetos_previsao.previsao_texto
           FROM projetos_previsao
          WHERE projetos_previsao.eng_projeto_id = ep.id
          ORDER BY projetos_previsao.data_registro DESC
         LIMIT 1) AS ultima_previsao,
    ( SELECT projetos_previsao.feito_texto
           FROM projetos_previsao
          WHERE projetos_previsao.eng_projeto_id = ep.id
          ORDER BY projetos_previsao.data_registro DESC
         LIMIT 1) AS ultimo_feito,
        CASE
            WHEN ep.data_prevista < public.hoje_brt() AND COALESCE(ep.percentual_ponderado, 0::numeric) < 100::numeric THEN public.hoje_brt() - ep.data_prevista
            ELSE 0
        END AS dias_atraso,
    p.descricao,
    ep.instancia_label,
    COALESCE(vr.horas_trabalhadas_total, 0::numeric) AS horas_trabalhadas_total,
    COALESCE(vr.horas_retrabalho_total, 0::numeric) AS horas_retrabalho_total
   FROM engenheiros_projetos ep
     JOIN engenheiros e ON e.eng_id = ep.eng_id
     JOIN projetos p ON p.projeto_id = ep.projeto_id
     JOIN areas a ON a.area_id = ep.area_id
     LEFT JOIN prazos pr ON pr.eng_projeto_id = ep.id
     LEFT JOIN vw_quantidade_retrabalhos vr ON vr.eng_projeto_id = ep.id
  WHERE ep.ativo = true;

-- view: vw_dono_visao_geral
CREATE OR REPLACE VIEW public.vw_dono_visao_geral WITH (security_invoker=on) AS
 SELECT e.eng_id,
    e.nome AS engenheiro_nome,
    e.exclusivo,
    count(DISTINCT ep.projeto_id) AS total_projetos,
    count(DISTINCT ep.id) AS total_areas,
    round(avg(ep.percentual_andamento), 2) AS media_percentual,
    count(ep.id) FILTER (WHERE ep.ativo = true AND ep.data_conclusao IS NULL) AS areas_ativas,
    COALESCE(sum(vr.quantidade_retrabalhos), 0::numeric) AS total_retrabalhos,
    round(avg(ct.nivel), 2) AS complexidade_media,
    sum(ep.tempo_trabalho_dias) FILTER (WHERE ep.ativo = true AND ep.data_conclusao IS NULL) AS dias_trabalho_pendentes,
    count(ep.id) FILTER (WHERE ep.data_prevista < public.hoje_brt() AND ep.data_conclusao IS NULL AND ep.ativo = true) AS areas_atrasadas
   FROM engenheiros e
     LEFT JOIN engenheiros_projetos ep ON ep.eng_id = e.eng_id
     LEFT JOIN vw_quantidade_retrabalhos vr ON vr.eng_projeto_id = ep.id
     LEFT JOIN evandro_distribuicao_tasks edt ON edt.eng_projeto_id = ep.id
     LEFT JOIN complexidade_tarefas ct ON ct.complexidade_id = edt.complexidade_id
  WHERE e.ativo = true
  GROUP BY e.eng_id, e.nome, e.exclusivo
  ORDER BY (count(DISTINCT ep.projeto_id)) DESC;

-- view: vw_dono_engenheiro_detalhado
CREATE OR REPLACE VIEW public.vw_dono_engenheiro_detalhado WITH (security_invoker=on) AS
 SELECT e.eng_id,
    e.nome AS engenheiro_nome,
    e.exclusivo,
    p.projeto_id,
    p.codigo_projeto,
    p.cliente,
    a.area_id,
    a.codigo AS area_codigo,
    a.descricao AS area_descricao,
    ep.data_inicio,
    ep.data_prevista,
    ep.data_conclusao,
    s.descricao AS status_descricao,
    ep.percentual_andamento AS taxa_execucao,
    ep.tempo_trabalho_dias,
    ct.descricao AS complexidade_descricao,
    ct.nivel AS complexidade_nivel,
    COALESCE(vr.quantidade_retrabalhos, 0::bigint) AS quantidade_retrabalhos,
    COALESCE(vr.percentual_retrabalhos, 0::numeric) AS percentual_retrabalhos,
    pr.prazo_final_eng,
    pr.prazo_final_cliente,
        CASE
            WHEN ep.data_prevista < public.hoje_brt() AND ep.data_conclusao IS NULL THEN public.hoje_brt() - ep.data_prevista
            ELSE 0
        END AS dias_atraso,
    ( SELECT projetos_previsao.data_registro
           FROM projetos_previsao
          WHERE projetos_previsao.eng_projeto_id = ep.id
          ORDER BY projetos_previsao.data_registro DESC
         LIMIT 1) AS ultima_atualizacao
   FROM engenheiros e
     JOIN engenheiros_projetos ep ON ep.eng_id = e.eng_id
     JOIN projetos p ON p.projeto_id = ep.projeto_id
     JOIN areas a ON a.area_id = ep.area_id
     LEFT JOIN status_codes s ON s.status_id = ep.status_id
     LEFT JOIN evandro_distribuicao_tasks edt ON edt.eng_projeto_id = ep.id
     LEFT JOIN complexidade_tarefas ct ON ct.complexidade_id = edt.complexidade_id
     LEFT JOIN vw_quantidade_retrabalhos vr ON vr.eng_projeto_id = ep.id
     LEFT JOIN prazos pr ON pr.eng_projeto_id = ep.id
  WHERE e.ativo = true AND ep.ativo = true
  ORDER BY e.nome, p.codigo_projeto, a.descricao;

-- view: vw_bloco2_atrasos_engenheiro
CREATE OR REPLACE VIEW public.vw_bloco2_atrasos_engenheiro WITH (security_invoker=on) AS
 SELECT e.eng_id,
    e.nome AS engenheiro,
    count(DISTINCT ep.projeto_id) FILTER (WHERE ep.data_prevista < public.hoje_brt() AND ep.data_conclusao IS NULL) AS qtde_projetos_atrasados,
    count(ep.id) FILTER (WHERE ep.data_prevista < public.hoje_brt() AND ep.data_conclusao IS NULL) AS qtde_areas_atrasadas,
    round(avg(
        CASE
            WHEN ep.data_prevista < public.hoje_brt() AND ep.data_conclusao IS NULL THEN public.hoje_brt() - ep.data_prevista
            ELSE NULL::integer
        END), 2) AS dias_medios_atraso,
    max(
        CASE
            WHEN ep.data_prevista < public.hoje_brt() AND ep.data_conclusao IS NULL THEN public.hoje_brt() - ep.data_prevista
            ELSE 0
        END) AS atraso_maximo_dias
   FROM engenheiros e
     LEFT JOIN engenheiros_projetos ep ON ep.eng_id = e.eng_id AND ep.ativo = true
  WHERE e.ativo = true
  GROUP BY e.eng_id, e.nome
 HAVING count(ep.id) FILTER (WHERE ep.data_prevista < public.hoje_brt() AND ep.data_conclusao IS NULL) > 0
  ORDER BY (round(avg(
        CASE
            WHEN ep.data_prevista < public.hoje_brt() AND ep.data_conclusao IS NULL THEN public.hoje_brt() - ep.data_prevista
            ELSE NULL::integer
        END), 2)) DESC;

-- view: vw_bloco2_atrasos_area
CREATE OR REPLACE VIEW public.vw_bloco2_atrasos_area WITH (security_invoker=on) AS
 SELECT a.area_id,
    a.codigo AS area_codigo,
    a.descricao AS area,
    count(ep.id) FILTER (WHERE ep.data_prevista < public.hoje_brt() AND ep.data_conclusao IS NULL) AS qtde_atrasados,
    round(avg(
        CASE
            WHEN ep.data_prevista < public.hoje_brt() AND ep.data_conclusao IS NULL THEN public.hoje_brt() - ep.data_prevista
            ELSE NULL::integer
        END), 2) AS dias_medio_atraso,
    count(DISTINCT ep.projeto_id) AS total_projetos_area
   FROM areas a
     LEFT JOIN engenheiros_projetos ep ON ep.area_id = a.area_id AND ep.ativo = true
  WHERE a.ativo = true
  GROUP BY a.area_id, a.codigo, a.descricao
 HAVING count(ep.id) FILTER (WHERE ep.data_prevista < public.hoje_brt() AND ep.data_conclusao IS NULL) > 0
  ORDER BY (round(avg(
        CASE
            WHEN ep.data_prevista < public.hoje_brt() AND ep.data_conclusao IS NULL THEN public.hoje_brt() - ep.data_prevista
            ELSE NULL::integer
        END), 2)) DESC;

-- view: vw_grafico_atrasos_engenheiro
CREATE OR REPLACE VIEW public.vw_grafico_atrasos_engenheiro WITH (security_invoker=on) AS
 SELECT e.nome AS engenheiro,
    count(ep.id) FILTER (WHERE ep.data_prevista < public.hoje_brt() AND ep.data_conclusao IS NULL) AS qtde_atrasados
   FROM engenheiros e
     LEFT JOIN engenheiros_projetos ep ON ep.eng_id = e.eng_id AND ep.ativo = true
  WHERE e.ativo = true
  GROUP BY e.eng_id, e.nome
  ORDER BY (count(ep.id) FILTER (WHERE ep.data_prevista < public.hoje_brt() AND ep.data_conclusao IS NULL)) DESC;

-- view: vw_bloco1_visao_geral
CREATE OR REPLACE VIEW public.vw_bloco1_visao_geral AS
 SELECT ( SELECT count(*) AS count
           FROM projetos
          WHERE projetos.ativo = true) AS total_projetos,
    ( SELECT count(*) AS count
           FROM projetos p
          WHERE p.ativo = true AND (EXISTS ( SELECT 1
                   FROM engenheiros_projetos ep
                  WHERE ep.projeto_id = p.projeto_id AND ep.ativo = true)) AND NOT (EXISTS ( SELECT 1
                   FROM engenheiros_projetos ep
                  WHERE ep.projeto_id = p.projeto_id AND ep.ativo = true AND COALESCE(ep.percentual_ponderado, 0::numeric) < 100::numeric))) AS projetos_concluidos,
    ( SELECT count(*) AS count
           FROM projetos p
          WHERE p.ativo = true AND (EXISTS ( SELECT 1
                   FROM engenheiros_projetos ep
                  WHERE ep.projeto_id = p.projeto_id AND ep.ativo = true AND COALESCE(ep.percentual_ponderado, 0::numeric) < 100::numeric))) AS projetos_em_execucao,
    ( SELECT count(DISTINCT p.projeto_id) AS count
           FROM projetos p
             JOIN engenheiros_projetos ep ON ep.projeto_id = p.projeto_id AND ep.ativo = true
          WHERE p.ativo = true AND COALESCE(ep.percentual_ponderado, 0::numeric) < 100::numeric AND ep.data_prevista < public.hoje_brt()) AS projetos_atrasados,
    ( SELECT round(COALESCE(avg(projetos.percentual_ponderado), 0::numeric), 2) AS round
           FROM projetos
          WHERE projetos.ativo = true) AS percentual_concluido_medio,
    ( SELECT count(*) AS count
           FROM engenheiros_projetos
          WHERE engenheiros_projetos.ativo = true) AS total_areas,
    ( SELECT count(*) AS count
           FROM engenheiros_projetos
          WHERE engenheiros_projetos.ativo = true AND engenheiros_projetos.data_conclusao IS NOT NULL) AS areas_concluidas,
    ( SELECT count(*) AS count
           FROM engenheiros_projetos
          WHERE engenheiros_projetos.ativo = true AND engenheiros_projetos.data_conclusao IS NULL) AS areas_ativas;

-- view: vw_projetos_detalhado
CREATE OR REPLACE VIEW public.vw_projetos_detalhado AS
 SELECT ep.id AS atribuicao_id,
    ep.eng_id,
    ep.area_id,
    p.projeto_id,
    p.codigo_projeto,
    COALESCE(p.cliente, 'Sem cliente'::text) AS cliente,
    p.descricao,
    COALESCE(e.nome, 'Sem engenheiro'::text) AS engenheiro_nome,
    a.codigo AS area_codigo,
    COALESCE(a.descricao, 'Sem area'::text) AS area_descricao,
    ep.instancia_label,
        CASE
            WHEN COALESCE(ep.percentual_ponderado, 0::numeric) >= 100::numeric THEN 'Concluido'::text
            WHEN COALESCE(ep.percentual_ponderado, 0::numeric) > 0::numeric THEN 'Em Andamento'::text
            ELSE 'Aguardando Inicio'::text
        END AS status_descricao,
    COALESCE(ep.percentual_ponderado, 0::numeric) AS percentual_andamento,
    ep.data_inicio,
    ep.data_prevista,
    ep.data_conclusao,
        CASE
            WHEN ep.data_prevista < public.hoje_brt() AND COALESCE(ep.percentual_ponderado, 0::numeric) < 100::numeric THEN public.hoje_brt() - ep.data_prevista
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

COMMIT;

-- -----------------------------------------------------
-- Conferencia (so leitura) — deve voltar ZERO linhas
-- -----------------------------------------------------
SELECT 'funcao' AS tipo, p.oid::regprocedure::text AS objeto
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prokind IN ('f', 'p')
  AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
  AND pg_get_functiondef(p.oid) ILIKE '%current_date%'
UNION ALL
SELECT 'view', c.relname
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('v', 'm')
  AND pg_get_viewdef(c.oid) ILIKE '%current_date%'
UNION ALL
SELECT 'default', c.relname || '.' || a.attname
FROM pg_attrdef ad
JOIN pg_class c ON c.oid = ad.adrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_attribute a ON a.attrelid = ad.adrelid AND a.attnum = ad.adnum
WHERE n.nspname = 'public' AND pg_get_expr(ad.adbin, ad.adrelid) ILIKE '%current_date%';
