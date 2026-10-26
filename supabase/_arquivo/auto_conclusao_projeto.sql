-- =====================================================
-- AUTO-CONCLUSÃO DE PROJETOS
-- =====================================================
-- Este arquivo cria trigger para preencher automaticamente
-- a data_conclusao quando o status é alterado para CONCLUIDO
-- =====================================================

-- =====================================================
-- FUNCTION: auto_preencher_data_conclusao
-- Preenche data_conclusao automaticamente quando status = CONCLUIDO
-- =====================================================

CREATE OR REPLACE FUNCTION auto_preencher_data_conclusao()
RETURNS TRIGGER AS $$
DECLARE
    v_status_codigo TEXT;
BEGIN
    -- Busca o código do status
    SELECT codigo INTO v_status_codigo
    FROM status_codes
    WHERE status_id = NEW.status_id;
    
    -- Se o status foi alterado para CONCLUIDO e data_conclusao está vazia
    IF v_status_codigo = 'CONCLUIDO' AND NEW.data_conclusao IS NULL THEN
        NEW.data_conclusao := CURRENT_DATE;
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
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION auto_preencher_data_conclusao IS 'Preenche data_conclusao automaticamente quando status = CONCLUIDO';

-- =====================================================
-- TRIGGER: Auto-preencher data_conclusao
-- =====================================================

DROP TRIGGER IF EXISTS trg_auto_conclusao ON engenheiros_projetos;
CREATE TRIGGER trg_auto_conclusao
    BEFORE INSERT OR UPDATE OF status_id ON engenheiros_projetos
    FOR EACH ROW
    EXECUTE FUNCTION auto_preencher_data_conclusao();

COMMENT ON TRIGGER trg_auto_conclusao ON engenheiros_projetos IS 'Preenche data_conclusao quando status = CONCLUIDO';

-- =====================================================
-- FIM DO ARQUIVO
-- =====================================================

