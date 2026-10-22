-- =====================================================
-- ROLLBACK de 20261023_retrabalho_dia_brt_e_limite_horas.sql
-- =====================================================
-- Volta registrar_retrabalho_dia a assinatura de 7 parametros, gravando em
-- CURRENT_DATE (o comportamento anterior, com o bug do fuso), e tira o CHECK
-- de 24h. ATENCAO: o codigo que manda p_data deixa de gravar horas se isto
-- for aplicado com ele no ar — so use junto com o rollback do deploy.
-- hoje_brt() fica (inofensiva). Definicao copiada de 20260728_retrabalho_por_horas.sql.
-- =====================================================

BEGIN;

ALTER TABLE retrabalho_projetos DROP CONSTRAINT IF EXISTS chk_retrabalho_horas_max_dia;

DROP FUNCTION IF EXISTS registrar_retrabalho_dia(UUID, BOOLEAN, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, DATE);

CREATE OR REPLACE FUNCTION registrar_retrabalho_dia(
    p_atribuicao_id UUID,
    p_necessitou_retrabalho BOOLEAN,
    p_motivo_retrabalho TEXT DEFAULT NULL,
    p_tipo_retrabalho TEXT DEFAULT NULL,
    p_descricao TEXT DEFAULT NULL,
    p_horas_trabalhadas_total NUMERIC DEFAULT NULL,
    p_horas_retrabalho NUMERIC DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_retrabalho_id UUID;
    v_projeto_id UUID;
    v_eng_id UUID;
    v_status_id INTEGER;
    v_quantidade INTEGER;
    v_existe_hoje BOOLEAN;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM engenheiros_projetos WHERE id = p_atribuicao_id AND ativo = true) THEN
        RETURN json_build_object('sucesso', false, 'mensagem', 'Atribuição não encontrada');
    END IF;

    IF p_horas_trabalhadas_total IS NOT NULL AND p_horas_trabalhadas_total < 0 THEN
        RETURN json_build_object('sucesso', false, 'mensagem', 'Horas trabalhadas totais não podem ser negativas');
    END IF;

    IF p_horas_retrabalho IS NOT NULL AND p_horas_retrabalho < 0 THEN
        RETURN json_build_object('sucesso', false, 'mensagem', 'Horas de retrabalho não podem ser negativas');
    END IF;

    IF p_horas_trabalhadas_total IS NOT NULL
       AND p_horas_retrabalho IS NOT NULL
       AND p_horas_retrabalho > p_horas_trabalhadas_total THEN
        RETURN json_build_object('sucesso', false, 'mensagem', 'Horas de retrabalho não podem exceder as horas trabalhadas totais');
    END IF;

    IF p_necessitou_retrabalho = false THEN
        p_motivo_retrabalho := NULL;
        p_tipo_retrabalho := NULL;
        p_horas_retrabalho := COALESCE(p_horas_retrabalho, 0);
    END IF;

    IF p_necessitou_retrabalho = true AND (p_motivo_retrabalho IS NULL OR TRIM(p_motivo_retrabalho) = '') THEN
        RETURN json_build_object('sucesso', false, 'mensagem', 'Motivo do retrabalho é obrigatório');
    END IF;

    SELECT projeto_id, eng_id, status_id
    INTO v_projeto_id, v_eng_id, v_status_id
    FROM engenheiros_projetos
    WHERE id = p_atribuicao_id;

    SELECT EXISTS (
        SELECT 1
        FROM retrabalho_projetos
        WHERE eng_projeto_id = p_atribuicao_id
          AND data_retrabalho = CURRENT_DATE
    ) INTO v_existe_hoje;

    IF v_existe_hoje THEN
        UPDATE retrabalho_projetos
        SET
            necessitou_retrabalho = p_necessitou_retrabalho,
            motivo_retrabalho = p_motivo_retrabalho,
            tipo_retrabalho = p_tipo_retrabalho,
            descricao = p_descricao,
            horas_trabalhadas_total = p_horas_trabalhadas_total,
            horas_retrabalho = p_horas_retrabalho
        WHERE eng_projeto_id = p_atribuicao_id
          AND data_retrabalho = CURRENT_DATE
        RETURNING id INTO v_retrabalho_id;
    ELSE
        INSERT INTO retrabalho_projetos (
            eng_projeto_id,
            projeto_id,
            eng_id,
            necessitou_retrabalho,
            motivo_retrabalho,
            tipo_retrabalho,
            descricao,
            horas_trabalhadas_total,
            horas_retrabalho,
            data_retrabalho,
            status_id
        ) VALUES (
            p_atribuicao_id,
            v_projeto_id,
            v_eng_id,
            p_necessitou_retrabalho,
            p_motivo_retrabalho,
            p_tipo_retrabalho,
            p_descricao,
            p_horas_trabalhadas_total,
            p_horas_retrabalho,
            CURRENT_DATE,
            v_status_id
        )
        RETURNING id INTO v_retrabalho_id;
    END IF;

    SELECT COUNT(*) INTO v_quantidade
    FROM retrabalho_projetos
    WHERE eng_projeto_id = p_atribuicao_id
      AND necessitou_retrabalho = true;

    RETURN json_build_object(
        'sucesso', true,
        'mensagem', CASE
            WHEN v_existe_hoje THEN 'Registro de retrabalho atualizado'
            ELSE 'Registro de retrabalho criado'
        END,
        'retrabalho_id', v_retrabalho_id,
        'necessitou_retrabalho', p_necessitou_retrabalho,
        'quantidade_total_retrabalhos', v_quantidade,
        'horas_trabalhadas_total', p_horas_trabalhadas_total,
        'horas_retrabalho', p_horas_retrabalho,
        'data', CURRENT_DATE
    );
END;
$$ LANGUAGE plpgsql;

REVOKE ALL ON FUNCTION registrar_retrabalho_dia(UUID, BOOLEAN, TEXT, TEXT, TEXT, NUMERIC, NUMERIC)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION registrar_retrabalho_dia(UUID, BOOLEAN, TEXT, TEXT, TEXT, NUMERIC, NUMERIC)
    TO service_role;

COMMIT;
