-- Patch manual para bancos onde a migration
-- supabase/migrations/20260729_complemento_etapas_instancias.sql
-- ja foi aplicada antes da correcao dos filtros por instancia.
--
-- Este arquivo e seguro para colar no Supabase SQL Editor porque:
-- - nao reexecuta backfills da migration original;
-- - nao altera dados imediatamente;
-- - apenas substitui funcoes por CREATE OR REPLACE FUNCTION;
-- - trata eng_projeto_id NULL como instancia legada, nao como coringa.
--
-- Se a migration 20260729 ainda nao foi aplicada nesse banco, nao use este
-- patch manual: aplique a migration corrigida pelo fluxo normal.

BEGIN;

SET LOCAL search_path = public;

DROP FUNCTION IF EXISTS ajustar_residuo_pesos(UUID, UUID);
DROP FUNCTION IF EXISTS calcular_progresso_area(UUID, UUID);
DROP FUNCTION IF EXISTS configurar_pavimentos_customizados_area(UUID, UUID, TEXT[]);

CREATE OR REPLACE FUNCTION ajustar_residuo_pesos(
    p_projeto_id UUID,
    p_area_id UUID,
    p_eng_projeto_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_soma_n1 NUMERIC(5,2);
    v_residuo_n1 NUMERIC(5,2);
    v_pav RECORD;
    v_soma_etapa NUMERIC(5,2);
    v_residuo_etapa NUMERIC(5,2);
    v_target_pav UUID;
    v_target_glb UUID;
BEGIN
    SELECT
        COALESCE((
            SELECT SUM(pp.peso)
            FROM projeto_pavimentos pp
            WHERE pp.projeto_id = p_projeto_id
              AND pp.area_id = p_area_id
              AND pp.ativo = true
              AND COALESCE(pp.eng_projeto_id, '00000000-0000-0000-0000-000000000000'::UUID) =
                  COALESCE(p_eng_projeto_id, '00000000-0000-0000-0000-000000000000'::UUID)
        ), 0) +
        COALESCE((
            SELECT SUM(peg.peso)
            FROM projeto_etapas_globais peg
            WHERE peg.projeto_id = p_projeto_id
              AND peg.area_id = p_area_id
              AND peg.ativo = true
              AND COALESCE(peg.eng_projeto_id, '00000000-0000-0000-0000-000000000000'::UUID) =
                  COALESCE(p_eng_projeto_id, '00000000-0000-0000-0000-000000000000'::UUID)
        ), 0)
    INTO v_soma_n1;

    v_residuo_n1 := 100 - v_soma_n1;

    IF v_residuo_n1 != 0 THEN
        SELECT pavimento_id INTO v_target_pav
        FROM projeto_pavimentos
        WHERE projeto_id = p_projeto_id
          AND area_id = p_area_id
          AND ativo = true
          AND COALESCE(eng_projeto_id, '00000000-0000-0000-0000-000000000000'::UUID) =
              COALESCE(p_eng_projeto_id, '00000000-0000-0000-0000-000000000000'::UUID)
        ORDER BY ordem DESC
        LIMIT 1;

        IF v_target_pav IS NOT NULL THEN
            UPDATE projeto_pavimentos
            SET peso = peso + v_residuo_n1
            WHERE pavimento_id = v_target_pav;
        ELSE
            SELECT etapa_global_id INTO v_target_glb
            FROM projeto_etapas_globais
            WHERE projeto_id = p_projeto_id
              AND area_id = p_area_id
              AND ativo = true
              AND COALESCE(eng_projeto_id, '00000000-0000-0000-0000-000000000000'::UUID) =
                  COALESCE(p_eng_projeto_id, '00000000-0000-0000-0000-000000000000'::UUID)
            ORDER BY created_at DESC
            LIMIT 1;

            IF v_target_glb IS NOT NULL THEN
                UPDATE projeto_etapas_globais
                SET peso = peso + v_residuo_n1
                WHERE etapa_global_id = v_target_glb;
            END IF;
        END IF;
    END IF;

    FOR v_pav IN
        SELECT pavimento_id
        FROM projeto_pavimentos
        WHERE projeto_id = p_projeto_id
          AND area_id = p_area_id
          AND ativo = true
          AND COALESCE(eng_projeto_id, '00000000-0000-0000-0000-000000000000'::UUID) =
              COALESCE(p_eng_projeto_id, '00000000-0000-0000-0000-000000000000'::UUID)
    LOOP
        SELECT COALESCE(SUM(peso), 0) INTO v_soma_etapa
        FROM pavimento_etapas
        WHERE pavimento_id = v_pav.pavimento_id
          AND ativo = true;

        v_residuo_etapa := 100 - v_soma_etapa;

        IF v_soma_etapa > 0 AND v_residuo_etapa != 0 THEN
            UPDATE pavimento_etapas
            SET peso = peso + v_residuo_etapa
            WHERE etapa_id = (
                SELECT etapa_id
                FROM pavimento_etapas
                WHERE pavimento_id = v_pav.pavimento_id
                  AND ativo = true
                ORDER BY created_at DESC
                LIMIT 1
            );
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION calcular_progresso_area(
    p_projeto_id UUID,
    p_area_id UUID,
    p_eng_projeto_id UUID DEFAULT NULL
)
RETURNS NUMERIC AS $$
DECLARE
    v_contrib_pav NUMERIC := 0;
    v_contrib_glob NUMERIC := 0;
    v_pav RECORD;
    v_interno NUMERIC;
    v_total NUMERIC;
BEGIN
    FOR v_pav IN
        SELECT pavimento_id, peso
        FROM projeto_pavimentos
        WHERE projeto_id = p_projeto_id
          AND area_id = p_area_id
          AND ativo = true
          AND COALESCE(eng_projeto_id, '00000000-0000-0000-0000-000000000000'::UUID) =
              COALESCE(p_eng_projeto_id, '00000000-0000-0000-0000-000000000000'::UUID)
    LOOP
        SELECT COALESCE(SUM(peso), 0) INTO v_interno
        FROM pavimento_etapas
        WHERE pavimento_id = v_pav.pavimento_id
          AND concluida = true
          AND ativo = true;

        v_contrib_pav := v_contrib_pav + (v_pav.peso * v_interno / 100.0);
    END LOOP;

    SELECT COALESCE(SUM(peso), 0) INTO v_contrib_glob
    FROM projeto_etapas_globais
    WHERE projeto_id = p_projeto_id
      AND area_id = p_area_id
      AND concluida = true
      AND ativo = true
      AND COALESCE(eng_projeto_id, '00000000-0000-0000-0000-000000000000'::UUID) =
          COALESCE(p_eng_projeto_id, '00000000-0000-0000-0000-000000000000'::UUID);

    v_total := v_contrib_pav + v_contrib_glob;
    IF v_total > 100 THEN
        v_total := 100;
    ELSIF v_total < 0 THEN
        v_total := 0;
    END IF;

    RETURN ROUND(v_total, 2);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION configurar_pavimentos_customizados_area(
    p_projeto_id UUID,
    p_area_id UUID,
    p_pavimentos TEXT[],
    p_eng_projeto_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_raw TEXT;
    v_nome TEXT;
    v_nomes TEXT[] := ARRAY[]::TEXT[];
    v_globais_count INTEGER;
    v_etapas_pav_count INTEGER;
    v_total_n1 INTEGER;
    v_peso_n1 NUMERIC(5,2);
    v_peso_etapa NUMERIC(5,2);
    v_pavimento_id UUID;
    v_ordem INTEGER := 0;
BEGIN
    FOREACH v_raw IN ARRAY COALESCE(p_pavimentos, ARRAY[]::TEXT[]) LOOP
        v_nome := btrim(regexp_replace(COALESCE(v_raw, ''), '\s+', ' ', 'g'));

        IF v_nome <> ''
           AND NOT EXISTS (
               SELECT 1
               FROM unnest(v_nomes) AS nome_existente(nome)
               WHERE lower(nome_existente.nome) = lower(v_nome)
           )
        THEN
            v_nomes := array_append(v_nomes, v_nome);
        END IF;
    END LOOP;

    IF COALESCE(array_length(v_nomes, 1), 0) = 0 THEN
        RETURN;
    END IF;

    SELECT COUNT(*) INTO v_etapas_pav_count
    FROM area_etapas_template
    WHERE area_id = p_area_id
      AND tipo = 'pavimento'
      AND ativo = true;

    IF v_etapas_pav_count = 0 THEN
        RETURN;
    END IF;

    SELECT COUNT(*) INTO v_globais_count
    FROM area_etapas_template
    WHERE area_id = p_area_id
      AND tipo = 'global'
      AND ativo = true;

    v_total_n1 := COALESCE(array_length(v_nomes, 1), 0) + v_globais_count;
    IF v_total_n1 = 0 THEN
        RETURN;
    END IF;

    v_peso_n1 := ROUND(100.0 / v_total_n1, 2);
    v_peso_etapa := ROUND(100.0 / v_etapas_pav_count, 2);

    IF EXISTS (
        SELECT 1
        FROM projeto_pavimentos pp
        JOIN pavimento_etapas pe ON pe.pavimento_id = pp.pavimento_id
        WHERE pp.projeto_id = p_projeto_id
          AND pp.area_id = p_area_id
          AND COALESCE(pp.eng_projeto_id, '00000000-0000-0000-0000-000000000000'::UUID) =
              COALESCE(p_eng_projeto_id, '00000000-0000-0000-0000-000000000000'::UUID)
          AND pe.concluida = true
    ) OR EXISTS (
        SELECT 1
        FROM projeto_etapas_globais peg
        WHERE peg.projeto_id = p_projeto_id
          AND peg.area_id = p_area_id
          AND COALESCE(peg.eng_projeto_id, '00000000-0000-0000-0000-000000000000'::UUID) =
              COALESCE(p_eng_projeto_id, '00000000-0000-0000-0000-000000000000'::UUID)
          AND peg.concluida = true
    ) THEN
        RAISE EXCEPTION 'Nao e possivel substituir pavimentos de uma disciplina com progresso concluido';
    END IF;

    DELETE FROM projeto_pavimentos
    WHERE projeto_id = p_projeto_id
      AND area_id = p_area_id
      AND COALESCE(eng_projeto_id, '00000000-0000-0000-0000-000000000000'::UUID) =
          COALESCE(p_eng_projeto_id, '00000000-0000-0000-0000-000000000000'::UUID);

    UPDATE projeto_etapas_globais
    SET peso = v_peso_n1
    WHERE projeto_id = p_projeto_id
      AND area_id = p_area_id
      AND ativo = true
      AND COALESCE(eng_projeto_id, '00000000-0000-0000-0000-000000000000'::UUID) =
          COALESCE(p_eng_projeto_id, '00000000-0000-0000-0000-000000000000'::UUID);

    FOREACH v_nome IN ARRAY v_nomes LOOP
        v_ordem := v_ordem + 1;

        INSERT INTO projeto_pavimentos (
            projeto_id,
            area_id,
            eng_projeto_id,
            nome,
            ordem,
            peso,
            ativo
        ) VALUES (
            p_projeto_id,
            p_area_id,
            p_eng_projeto_id,
            v_nome,
            v_ordem,
            v_peso_n1,
            true
        )
        RETURNING pavimento_id INTO v_pavimento_id;

        INSERT INTO pavimento_etapas (pavimento_id, nome, peso, ativo)
        SELECT v_pavimento_id, nome, v_peso_etapa, true
        FROM area_etapas_template
        WHERE area_id = p_area_id
          AND tipo = 'pavimento'
          AND ativo = true
        ORDER BY ordem;
    END LOOP;

    PERFORM ajustar_residuo_pesos(p_projeto_id, p_area_id, p_eng_projeto_id);
    PERFORM recalcular_rollup_projeto(p_projeto_id);
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- Pos-checagem opcional: deve listar as 3 assinaturas corrigidas.
SELECT
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'ajustar_residuo_pesos',
    'calcular_progresso_area',
    'configurar_pavimentos_customizados_area'
  )
ORDER BY p.proname, arguments;
