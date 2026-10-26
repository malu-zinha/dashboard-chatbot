-- =====================================================
-- SINCRONIZAÇÃO BIDIRECIONAL: engenheiros_projetos <-> prazos
-- =====================================================
-- Este arquivo cria triggers para manter as datas sincronizadas
-- entre as tabelas engenheiros_projetos e prazos
-- =====================================================

-- =====================================================
-- FUNCTION: sync_datas_para_prazos
-- Sincroniza datas de engenheiros_projetos -> prazos
-- =====================================================

CREATE OR REPLACE FUNCTION sync_datas_para_prazos()
RETURNS TRIGGER AS $$
BEGIN
    -- Quando data_inicio ou data_prevista mudam em engenheiros_projetos
    -- atualiza as datas correspondentes em prazos
    
    -- IMPORTANTE: Só atualiza se os valores mudaram (evita recursão infinita)
    IF (TG_OP = 'UPDATE' AND 
        (OLD.data_inicio IS DISTINCT FROM NEW.data_inicio OR 
         OLD.data_prevista IS DISTINCT FROM NEW.data_prevista)) OR
       TG_OP = 'INSERT' THEN
        
        IF EXISTS (SELECT 1 FROM prazos WHERE eng_projeto_id = NEW.id) THEN
            UPDATE prazos
            SET 
                data_inicio_projeto = NEW.data_inicio,
                prazo_final_eng = NEW.data_prevista,
                updated_at = NOW()
            WHERE eng_projeto_id = NEW.id
            -- Só atualiza se realmente mudou (evita trigger em loop)
            AND (data_inicio_projeto IS DISTINCT FROM NEW.data_inicio OR
                 prazo_final_eng IS DISTINCT FROM NEW.data_prevista);
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION sync_datas_para_prazos IS 'Sincroniza data_inicio e data_prevista de engenheiros_projetos para prazos (com proteção contra recursão)';

-- =====================================================
-- FUNCTION: sync_datas_de_prazos
-- Sincroniza datas de prazos -> engenheiros_projetos
-- =====================================================

CREATE OR REPLACE FUNCTION sync_datas_de_prazos()
RETURNS TRIGGER AS $$
BEGIN
    -- Quando data_inicio_projeto ou prazo_final_eng mudam em prazos
    -- atualiza as datas correspondentes em engenheiros_projetos
    
    -- IMPORTANTE: Só atualiza se os valores mudaram (evita recursão infinita)
    IF (TG_OP = 'UPDATE' AND 
        (OLD.data_inicio_projeto IS DISTINCT FROM NEW.data_inicio_projeto OR 
         OLD.prazo_final_eng IS DISTINCT FROM NEW.prazo_final_eng)) OR
       TG_OP = 'INSERT' THEN
        
        UPDATE engenheiros_projetos
        SET 
            data_inicio = NEW.data_inicio_projeto,
            data_prevista = NEW.prazo_final_eng,
            updated_at = NOW()
        WHERE id = NEW.eng_projeto_id
        -- Só atualiza se realmente mudou (evita trigger em loop)
        AND (data_inicio IS DISTINCT FROM NEW.data_inicio_projeto OR
             data_prevista IS DISTINCT FROM NEW.prazo_final_eng);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION sync_datas_de_prazos IS 'Sincroniza data_inicio_projeto e prazo_final_eng de prazos para engenheiros_projetos (com proteção contra recursão)';

-- =====================================================
-- TRIGGERS: Sincronização bidirecional
-- =====================================================

-- Trigger: engenheiros_projetos -> prazos
DROP TRIGGER IF EXISTS trg_sync_datas_para_prazos ON engenheiros_projetos;
CREATE TRIGGER trg_sync_datas_para_prazos
    AFTER INSERT OR UPDATE OF data_inicio, data_prevista ON engenheiros_projetos
    FOR EACH ROW
    EXECUTE FUNCTION sync_datas_para_prazos();

COMMENT ON TRIGGER trg_sync_datas_para_prazos ON engenheiros_projetos IS 'Sincroniza datas para tabela prazos quando engenheiros_projetos é modificado';

-- Trigger: prazos -> engenheiros_projetos
DROP TRIGGER IF EXISTS trg_sync_datas_de_prazos ON prazos;
CREATE TRIGGER trg_sync_datas_de_prazos
    AFTER INSERT OR UPDATE OF data_inicio_projeto, prazo_final_eng ON prazos
    FOR EACH ROW
    EXECUTE FUNCTION sync_datas_de_prazos();

COMMENT ON TRIGGER trg_sync_datas_de_prazos ON prazos IS 'Sincroniza datas para engenheiros_projetos quando prazos é modificado';

-- =====================================================
-- FIM DO ARQUIVO
-- =====================================================

