-- =====================================================
-- APLICAR TODOS OS TRIGGERS NO SUPABASE
-- =====================================================
-- Execute este script no Supabase SQL Editor para aplicar
-- TODOS os triggers de sincronização de uma vez
-- =====================================================

-- 1. SYNC: prazos ↔ engenheiros_projetos (datas)
-- =====================================================

CREATE OR REPLACE FUNCTION sync_prazos_to_engenheiros_projetos()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.data_inicio_projeto IS DISTINCT FROM OLD.data_inicio_projeto OR
       NEW.prazo_final_eng IS DISTINCT FROM OLD.prazo_final_eng THEN
        UPDATE engenheiros_projetos
        SET
            data_inicio = NEW.data_inicio_projeto,
            data_prevista = NEW.prazo_final_eng,
            updated_at = NOW()
        WHERE id = NEW.eng_projeto_id
        AND (data_inicio IS DISTINCT FROM NEW.data_inicio_projeto OR data_prevista IS DISTINCT FROM NEW.prazo_final_eng);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_prazos_to_engenheiros_projetos ON prazos;

CREATE TRIGGER trg_sync_prazos_to_engenheiros_projetos
AFTER INSERT OR UPDATE ON prazos
FOR EACH ROW
EXECUTE FUNCTION sync_prazos_to_engenheiros_projetos();

-- =====================================================

CREATE OR REPLACE FUNCTION sync_engenheiros_projetos_to_prazos()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.data_inicio IS DISTINCT FROM OLD.data_inicio OR
       NEW.data_prevista IS DISTINCT FROM OLD.data_prevista THEN
        UPDATE prazos
        SET
            data_inicio_projeto = NEW.data_inicio,
            prazo_final_eng = NEW.data_prevista,
            updated_at = NOW()
        WHERE eng_projeto_id = NEW.id
        AND (data_inicio_projeto IS DISTINCT FROM NEW.data_inicio OR prazo_final_eng IS DISTINCT FROM NEW.data_prevista);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_engenheiros_projetos_to_prazos ON engenheiros_projetos;

CREATE TRIGGER trg_sync_engenheiros_projetos_to_prazos
AFTER INSERT OR UPDATE ON engenheiros_projetos
FOR EACH ROW
EXECUTE FUNCTION sync_engenheiros_projetos_to_prazos();

-- 2. SYNC: projetos_previsao → engenheiros_projetos (status)
-- =====================================================

CREATE OR REPLACE FUNCTION sync_status_previsao_to_engenheiros()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status_id IS NOT NULL THEN
        UPDATE engenheiros_projetos
        SET 
            status_id = NEW.status_id,
            updated_at = NOW()
        WHERE id = NEW.eng_projeto_id
        AND (status_id IS DISTINCT FROM NEW.status_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_status_previsao_to_engenheiros ON projetos_previsao;

CREATE TRIGGER trg_sync_status_previsao_to_engenheiros
AFTER INSERT OR UPDATE ON projetos_previsao
FOR EACH ROW
WHEN (NEW.status_id IS NOT NULL)
EXECUTE FUNCTION sync_status_previsao_to_engenheiros();

-- 3. AUTO: data_conclusao quando status = CONCLUIDO
-- =====================================================

CREATE OR REPLACE FUNCTION auto_set_data_conclusao()
RETURNS TRIGGER AS $$
DECLARE
    v_concluido_status_id INTEGER;
BEGIN
    SELECT status_id INTO v_concluido_status_id FROM status_codes WHERE codigo = 'CONCLUIDO';

    IF NEW.status_id = v_concluido_status_id AND OLD.status_id IS DISTINCT FROM NEW.status_id THEN
        NEW.data_conclusao = NOW();
    ELSIF OLD.status_id = v_concluido_status_id AND NEW.status_id IS DISTINCT FROM v_concluido_status_id THEN
        NEW.data_conclusao = NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_set_data_conclusao ON engenheiros_projetos;

CREATE TRIGGER trg_auto_set_data_conclusao
BEFORE UPDATE OF status_id ON engenheiros_projetos
FOR EACH ROW
EXECUTE FUNCTION auto_set_data_conclusao();

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================

SELECT '✅ Todos os triggers aplicados com sucesso!' as mensagem;

SELECT 
    trigger_name,
    event_object_table as tabela,
    action_timing as quando,
    string_agg(event_manipulation, ', ') as eventos
FROM information_schema.triggers
WHERE trigger_name IN (
    'trg_sync_prazos_to_engenheiros_projetos',
    'trg_sync_engenheiros_projetos_to_prazos',
    'trg_sync_status_previsao_to_engenheiros',
    'trg_auto_set_data_conclusao'
)
GROUP BY trigger_name, event_object_table, action_timing
ORDER BY trigger_name;

