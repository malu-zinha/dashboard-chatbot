-- =====================================================
-- MIGRACAO: o dono altera o prazo de uma atribuicao e o engenheiro e avisado
-- =====================================================
-- APLICAR ANTES DO DEPLOY: o bot e o dashboard novos chamam a funcao e leem as
-- colunas novas. O codigo antigo nao usa nada disto, entao aplicar antes nao
-- quebra nada.
--
-- O que muda:
--   1. notificacoes_whatsapp ganha 6 colunas, todas nulas nas linhas antigas:
--        - eng_projeto_id: de qual atribuicao e o aviso (ON DELETE SET NULL,
--          para nao travar a limpeza de projetos antigos);
--        - twilio_sid, status_entrega, erro_codigo, status_atualizado_em:
--          o que aconteceu com o envio (o worker e o webhook do Twilio
--          preenchem depois). 'sem_telefone' marca aviso que nao tem para
--          onde ir.
--        - prazo_avisado: o prazo que o aviso leva ao engenheiro. O dashboard
--          so mostra o icone do aviso enquanto o prazo da tarefa e esse (se
--          o prazo mudar por outro caminho, o icone some).
--      Nao cria data_agendamento: o trigger antigo notificar_novo_projeto
--      (quebrado, hoje falha em silencio por falta dela) voltaria a gerar
--      avisos duplicados.
--   2. public.alterar_prazo_atribuicao(atribuicao, novo prazo, quem pediu):
--        - recusa atribuicao inexistente/inativa, concluida
--          (percentual_ponderado >= 100), prazo nulo ou antes do inicio, e a
--          mesma data;
--        - muda engenheiros_projetos.data_prevista (o trigger
--          trg_sync_datas_para_prazos leva para prazos.prazo_final_eng);
--        - empurra prazos.prazo_final_cliente so quando ele fica antes do novo
--          prazo (nunca puxa para tras);
--        - atualiza a copia em evandro_distribuicao_tasks;
--        - grava o aviso 'prazo_alterado' para o worker enviar. Se ja existe
--          um aviso desta atribuicao que o worker ainda nao pegou, ele e
--          reescrito (um aviso so, com o prazo que o engenheiro conhecia e o
--          prazo novo final). Sem telefone: grava com status_entrega
--          'sem_telefone' e o prazo muda do mesmo jeito. O aviso reescrito
--          volta a contar do zero (created_at = now()) e mantem o "Prazo
--          anterior" que ele ja levava, inclusive "não definido".
--      Erro inesperado volta com mensagem fixa (sem o texto do erro do banco)
--      e deixa um WARNING com o SQLSTATE no log do Postgres.
--   3. So o service_role executa a funcao (o dashboard chama pela rota do
--      dono, com a service role).
--
-- Nao altera nem apaga dado nenhum fora da funcao.
-- Conferir: secao 4.
-- Desfazer: supabase/rollbacks/20261029_alterar_prazo_atribuicao.rollback.sql
-- =====================================================

BEGIN;

-- -----------------------------------------------------
-- 1. Colunas e indices do aviso
-- -----------------------------------------------------
ALTER TABLE public.notificacoes_whatsapp
  ADD COLUMN IF NOT EXISTS eng_projeto_id uuid REFERENCES public.engenheiros_projetos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS twilio_sid text,
  ADD COLUMN IF NOT EXISTS status_entrega text,
  ADD COLUMN IF NOT EXISTS erro_codigo text,
  ADD COLUMN IF NOT EXISTS status_atualizado_em timestamptz,
  ADD COLUMN IF NOT EXISTS prazo_avisado date;

CREATE INDEX IF NOT EXISTS idx_notif_twilio_sid
  ON public.notificacoes_whatsapp (twilio_sid);

CREATE INDEX IF NOT EXISTS idx_notif_eng_projeto_tipo
  ON public.notificacoes_whatsapp (eng_projeto_id, tipo, created_at DESC);

-- -----------------------------------------------------
-- 2. Funcao
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.alterar_prazo_atribuicao(p_atribuicao_id uuid, p_novo_prazo date, p_actor_user_id uuid)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_eng_id UUID;
    v_projeto_id UUID;
    v_data_inicio DATE;
    v_prazo_anterior DATE;
    v_percentual_ponderado NUMERIC;
    v_codigo_projeto TEXT;
    v_cliente TEXT;
    v_area_label TEXT;
    v_telefone TEXT;
    v_cliente_ajustado INTEGER := 0;
    v_prazo_cliente DATE;
    v_pendente_id UUID;
    v_pendente_status TEXT;
    v_pendente_prazo TEXT;
    v_prazo_anterior_txt TEXT;
    v_status_entrega TEXT;
    v_msg_inicio TEXT;
    v_msg_fim TEXT;
    v_linhas INTEGER := 0;
BEGIN
    SELECT
        ep.eng_id,
        ep.projeto_id,
        ep.data_inicio,
        ep.data_prevista,
        ep.percentual_ponderado,
        p.codigo_projeto,
        p.cliente,
        COALESCE(ep.instancia_label, a.descricao),
        NULLIF(btrim(e.telefone), '')
    INTO
        v_eng_id,
        v_projeto_id,
        v_data_inicio,
        v_prazo_anterior,
        v_percentual_ponderado,
        v_codigo_projeto,
        v_cliente,
        v_area_label,
        v_telefone
    FROM public.engenheiros_projetos ep
    JOIN public.projetos p ON p.projeto_id = ep.projeto_id
    LEFT JOIN public.areas a ON a.area_id = ep.area_id
    LEFT JOIN public.engenheiros e ON e.eng_id = ep.eng_id
    WHERE ep.id = p_atribuicao_id
      AND ep.ativo
    FOR UPDATE OF ep;

    IF NOT FOUND THEN
        RETURN json_build_object(
            'ok', false,
            'codigo', 'nao_encontrada',
            'mensagem', 'Tarefa não encontrada ou já excluída.'
        );
    END IF;

    IF COALESCE(v_percentual_ponderado, 0) >= 100 THEN
        RETURN json_build_object(
            'ok', false,
            'codigo', 'concluida',
            'mensagem', 'Tarefa concluída não muda de prazo.'
        );
    END IF;

    IF p_novo_prazo IS NULL OR p_novo_prazo < v_data_inicio THEN
        RETURN json_build_object(
            'ok', false,
            'codigo', 'parametro_invalido',
            'mensagem', CASE
                WHEN p_novo_prazo IS NULL THEN 'Informe o novo prazo.'
                ELSE 'O prazo não pode ser antes do início (' || to_char(v_data_inicio, 'DD/MM/YYYY') || ').'
            END
        );
    END IF;

    IF p_novo_prazo = v_prazo_anterior THEN
        RETURN json_build_object(
            'ok', false,
            'codigo', 'sem_mudanca',
            'mensagem', 'O prazo já é essa data.'
        );
    END IF;

    -- prazo do engenheiro; trg_sync_datas_para_prazos leva para prazos.prazo_final_eng
    UPDATE public.engenheiros_projetos
    SET data_prevista = p_novo_prazo
    WHERE id = p_atribuicao_id;

    -- prazo do cliente so anda para frente (prazos nao tem UNIQUE: pode ser mais de uma linha)
    UPDATE public.prazos
    SET prazo_final_cliente = p_novo_prazo,
        updated_at = now()
    WHERE eng_projeto_id = p_atribuicao_id
      AND prazo_final_cliente < p_novo_prazo;

    GET DIAGNOSTICS v_cliente_ajustado = ROW_COUNT;

    SELECT max(prazo_final_cliente) INTO v_prazo_cliente
    FROM public.prazos
    WHERE eng_projeto_id = p_atribuicao_id;

    -- copia do prazo na task distribuida pelo bot
    UPDATE public.evandro_distribuicao_tasks
    SET data_conclusao_prevista = p_novo_prazo,
        updated_at = now()
    WHERE eng_projeto_id = p_atribuicao_id;

    v_status_entrega := CASE WHEN v_telefone IS NULL THEN 'sem_telefone' END;

    -- mensagem: inicio || prazo anterior || fim
    v_msg_inicio := E'📅 *Prazo alterado*\n\n'
        || '📋 Projeto: ' || COALESCE(v_codigo_projeto, 'N/A') || ' - ' || COALESCE(v_cliente, 'N/A') || E'\n'
        || '🔧 Área: ' || COALESCE(v_area_label, 'Não definida') || E'\n'
        || '⏰ Prazo anterior: ';
    v_msg_fim := E'\n'
        || '✅ Novo prazo: ' || to_char(p_novo_prazo, 'DD/MM/YYYY') || E'\n\n'
        || '_Digite "menu" para ver seus projetos_';
    v_prazo_anterior_txt := COALESCE(to_char(v_prazo_anterior, 'DD/MM/YYYY'), 'não definido');

    -- aviso desta atribuicao que o worker ainda nao pegou (tentativas = 0)
    SELECT
        notificacao_id,
        status_entrega,
        substring(mensagem from 'Prazo anterior: ([^\n]+)')
    INTO v_pendente_id, v_pendente_status, v_pendente_prazo
    FROM public.notificacoes_whatsapp
    WHERE eng_projeto_id = p_atribuicao_id
      AND eng_id = v_eng_id
      AND tipo = 'prazo_alterado'
      AND enviada = false
      AND tentativas = 0
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF v_pendente_id IS NOT NULL THEN
        -- o engenheiro ainda conhece o prazo anterior do aviso pendente;
        -- aviso 'sem_telefone' nunca chegou a ninguem: vale o prazo de antes desta chamada
        IF COALESCE(v_pendente_status, '') <> 'sem_telefone' AND v_pendente_prazo IS NOT NULL THEN
            v_prazo_anterior_txt := v_pendente_prazo;
        END IF;

        UPDATE public.notificacoes_whatsapp
        SET mensagem = v_msg_inicio || v_prazo_anterior_txt || v_msg_fim,
            telefone = v_telefone,
            status_entrega = v_status_entrega,
            prazo_avisado = p_novo_prazo,
            created_at = now()
        WHERE notificacao_id = v_pendente_id
          AND enviada = false
          AND tentativas = 0;

        GET DIAGNOSTICS v_linhas = ROW_COUNT;

        IF v_linhas = 0 THEN
            -- o worker pegou o aviso no meio: o novo parte do prazo de antes desta chamada
            v_prazo_anterior_txt := COALESCE(to_char(v_prazo_anterior, 'DD/MM/YYYY'), 'não definido');
        END IF;
    END IF;

    IF v_linhas = 0 THEN
        INSERT INTO public.notificacoes_whatsapp (
            eng_id,
            telefone,
            tipo,
            titulo,
            mensagem,
            projeto_id,
            eng_projeto_id,
            status_entrega,
            prazo_avisado
        ) VALUES (
            v_eng_id,
            v_telefone,
            'prazo_alterado',
            'Prazo alterado',
            v_msg_inicio || v_prazo_anterior_txt || v_msg_fim,
            v_projeto_id,
            p_atribuicao_id,
            v_status_entrega,
            p_novo_prazo
        );
    END IF;

    RETURN json_build_object(
        'ok', true,
        'codigo', 'ok',
        'mensagem', 'Prazo alterado.',
        'prazo_anterior', v_prazo_anterior,
        'prazo_novo', p_novo_prazo,
        'cliente_ajustado', v_cliente_ajustado,
        'prazo_cliente', v_prazo_cliente,
        'aviso', CASE WHEN v_telefone IS NULL THEN 'sem_telefone' ELSE 'na_fila' END
    );
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'alterar_prazo_atribuicao(%) falhou: SQLSTATE %', p_atribuicao_id, SQLSTATE;
        RETURN json_build_object(
            'ok', false,
            'codigo', 'erro_interno',
            'mensagem', 'Não foi possível alterar o prazo.'
        );
END;
$function$
;

-- -----------------------------------------------------
-- 3. Permissoes: so o service_role executa
-- -----------------------------------------------------
REVOKE ALL ON FUNCTION public.alterar_prazo_atribuicao(uuid, date, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.alterar_prazo_atribuicao(uuid, date, uuid) TO service_role;

COMMIT;

-- -----------------------------------------------------
-- 4. Conferencia (so leitura, rodar depois do COMMIT)
-- -----------------------------------------------------
-- Colunas novas (deve voltar 6 linhas):
--   SELECT column_name, data_type
--   FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'notificacoes_whatsapp'
--     AND column_name IN ('eng_projeto_id', 'twilio_sid', 'status_entrega',
--                         'erro_codigo', 'status_atualizado_em', 'prazo_avisado')
--   ORDER BY column_name;
--
-- Permissoes (deve voltar false, true):
--   SELECT
--     has_function_privilege('authenticated', 'public.alterar_prazo_atribuicao(uuid, date, uuid)', 'EXECUTE') AS authenticated,
--     has_function_privilege('service_role', 'public.alterar_prazo_atribuicao(uuid, date, uuid)', 'EXECUTE') AS service_role;
