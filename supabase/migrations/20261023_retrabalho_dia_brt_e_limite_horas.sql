-- =====================================================
-- MIGRACAO: apontamento no dia certo (BRT) e limite de 24h
-- =====================================================
-- 1. Fuso: registrar_retrabalho_dia gravava em CURRENT_DATE, que no Supabase
--    e UTC. Apontar depois das 21h BRT jogava as horas para o dia seguinte,
--    enquanto o relato (projetos_previsao) ja usava a data BRT do bot — a
--    mesma noite ficava partida em dois dias. Em 21/10/2026: 6 de 480
--    apontamentos. A funcao ganha p_data (opcional); sem ele, usa hoje_brt().
--
--    Por isso esta migration pode e DEVE ser aplicada ANTES do deploy do
--    codigo novo: o codigo antigo nao manda p_data e passa a cair no dia BRT;
--    o codigo novo manda p_data, que so existe depois desta migration.
--
-- 2. Concorrencia: o "existe? entao UPDATE senao INSERT" virou
--    INSERT ... ON CONFLICT. Duas mensagens seguidas batiam no UNIQUE
--    (eng_projeto_id, data_retrabalho) e a segunda dava erro.
--
-- 3. Limite: CHECK horas_trabalhadas_total <= 24, NOT VALID — vale so para
--    linhas novas; os registros antigos ficam exatamente como estao. A funcao
--    tambem recusa acima de 24h com mensagem clara. (O bot ja recusa acima de
--    16h; 24h e a barreira fisica.)
--
-- Nao altera nem apaga dado existente.
-- Conferir: secao 4. Desfazer: supabase/rollbacks/20261023_retrabalho_dia_brt_e_limite_horas.rollback.sql
-- =====================================================

BEGIN;

-- -----------------------------------------------------
-- 1. Dia de hoje no fuso de Brasilia
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION hoje_brt()
RETURNS DATE
LANGUAGE sql
STABLE
AS $$ SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::DATE $$;

COMMENT ON FUNCTION hoje_brt() IS
    'Data de hoje em America/Sao_Paulo. Usar no lugar de CURRENT_DATE (UTC no Supabase).';

-- Leitura pura: authenticated pode usar (views futuras), anon nao.
REVOKE ALL ON FUNCTION hoje_brt() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION hoje_brt() TO authenticated, service_role;

-- -----------------------------------------------------
-- 2. registrar_retrabalho_dia com p_data e ON CONFLICT
-- -----------------------------------------------------
-- A assinatura muda (p_data no fim), entao a antiga sai para nao haver duas
-- versoes ambiguas para o PostgREST.
DROP FUNCTION IF EXISTS registrar_retrabalho_dia(UUID, BOOLEAN, TEXT, TEXT, TEXT, NUMERIC, NUMERIC);

CREATE OR REPLACE FUNCTION registrar_retrabalho_dia(
    p_atribuicao_id UUID,
    p_necessitou_retrabalho BOOLEAN,
    p_motivo_retrabalho TEXT DEFAULT NULL,
    p_tipo_retrabalho TEXT DEFAULT NULL,
    p_descricao TEXT DEFAULT NULL,
    p_horas_trabalhadas_total NUMERIC DEFAULT NULL,
    p_horas_retrabalho NUMERIC DEFAULT NULL,
    p_data DATE DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_retrabalho_id UUID;
    v_projeto_id UUID;
    v_eng_id UUID;
    v_status_id INTEGER;
    v_quantidade INTEGER;
    v_existia BOOLEAN;
    v_data DATE := COALESCE(p_data, hoje_brt());
BEGIN
    IF NOT EXISTS (SELECT 1 FROM engenheiros_projetos WHERE id = p_atribuicao_id AND ativo = true) THEN
        RETURN json_build_object('sucesso', false, 'mensagem', 'Atribuição não encontrada');
    END IF;

    IF v_data > hoje_brt() THEN
        RETURN json_build_object('sucesso', false, 'mensagem', 'Não é possível apontar horas em data futura');
    END IF;

    IF p_horas_trabalhadas_total IS NOT NULL AND p_horas_trabalhadas_total < 0 THEN
        RETURN json_build_object('sucesso', false, 'mensagem', 'Horas trabalhadas totais não podem ser negativas');
    END IF;

    IF p_horas_trabalhadas_total IS NOT NULL AND p_horas_trabalhadas_total > 24 THEN
        RETURN json_build_object('sucesso', false, 'mensagem', 'Horas trabalhadas não podem passar de 24h num dia');
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
        SELECT 1 FROM retrabalho_projetos
        WHERE eng_projeto_id = p_atribuicao_id AND data_retrabalho = v_data
    ) INTO v_existia;

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
        v_data,
        v_status_id
    )
    ON CONFLICT (eng_projeto_id, data_retrabalho) DO UPDATE SET
        necessitou_retrabalho = EXCLUDED.necessitou_retrabalho,
        motivo_retrabalho = EXCLUDED.motivo_retrabalho,
        tipo_retrabalho = EXCLUDED.tipo_retrabalho,
        descricao = EXCLUDED.descricao,
        horas_trabalhadas_total = EXCLUDED.horas_trabalhadas_total,
        horas_retrabalho = EXCLUDED.horas_retrabalho
    RETURNING id INTO v_retrabalho_id;

    SELECT COUNT(*) INTO v_quantidade
    FROM retrabalho_projetos
    WHERE eng_projeto_id = p_atribuicao_id
      AND necessitou_retrabalho = true;

    RETURN json_build_object(
        'sucesso', true,
        'mensagem', CASE
            WHEN v_existia THEN 'Registro de retrabalho atualizado'
            ELSE 'Registro de retrabalho criado'
        END,
        'retrabalho_id', v_retrabalho_id,
        'necessitou_retrabalho', p_necessitou_retrabalho,
        'quantidade_total_retrabalhos', v_quantidade,
        'horas_trabalhadas_total', p_horas_trabalhadas_total,
        'horas_retrabalho', p_horas_retrabalho,
        'data', v_data
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION registrar_retrabalho_dia IS
    'Registra ou atualiza as horas do dia (BRT por padrao, ou p_data) com horas totais e de retrabalho';

-- Funcao de escrita: so service_role (mesma regra de 20261022). A assinatura
-- nova nasce com os privilegios padrao, entao e preciso revogar de novo.
REVOKE ALL ON FUNCTION registrar_retrabalho_dia(UUID, BOOLEAN, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, DATE)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION registrar_retrabalho_dia(UUID, BOOLEAN, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, DATE)
    TO service_role;

-- -----------------------------------------------------
-- 3. Limite fisico de horas por dia (so para linhas novas)
-- -----------------------------------------------------
ALTER TABLE retrabalho_projetos
    DROP CONSTRAINT IF EXISTS chk_retrabalho_horas_max_dia;
ALTER TABLE retrabalho_projetos
    ADD CONSTRAINT chk_retrabalho_horas_max_dia
        CHECK (horas_trabalhadas_total IS NULL OR horas_trabalhadas_total <= 24) NOT VALID;

COMMIT;

-- -----------------------------------------------------
-- 4. Conferencia (so leitura)
-- -----------------------------------------------------
-- Deve mostrar: hoje_brt = dia de hoje em Brasilia; uma unica versao da
-- funcao, com p_data; authenticated sem EXECUTE; constraint nao validada.
SELECT 'hoje_brt' AS item, hoje_brt()::TEXT AS valor
UNION ALL
SELECT 'versoes de registrar_retrabalho_dia', COUNT(*)::TEXT
FROM pg_proc WHERE proname = 'registrar_retrabalho_dia'
UNION ALL
SELECT 'assinatura', p.oid::regprocedure::TEXT
FROM pg_proc p WHERE p.proname = 'registrar_retrabalho_dia'
UNION ALL
SELECT 'authenticated executa?', has_function_privilege('authenticated', p.oid, 'EXECUTE')::TEXT
FROM pg_proc p WHERE p.proname = 'registrar_retrabalho_dia'
UNION ALL
SELECT 'chk_retrabalho_horas_max_dia validada?', convalidated::TEXT
FROM pg_constraint WHERE conname = 'chk_retrabalho_horas_max_dia';
