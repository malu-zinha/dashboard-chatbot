-- =====================================================
-- SINCRONIZAR STATUS: projetos_previsao → engenheiros_projetos
-- =====================================================
-- Quando o engenheiro registra uma previsão matinal com status,
-- esse status deve ser atualizado em engenheiros_projetos
-- =====================================================

CREATE OR REPLACE FUNCTION sync_status_previsao_to_engenheiros()
RETURNS TRIGGER AS $$
BEGIN
    -- Atualiza o status em engenheiros_projetos quando uma nova previsão é criada
    -- Apenas se o status for diferente do atual
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

-- Drop trigger se já existir
DROP TRIGGER IF EXISTS trg_sync_status_previsao_to_engenheiros ON projetos_previsao;

-- Criar trigger AFTER INSERT OR UPDATE (para capturar upserts também!)
CREATE TRIGGER trg_sync_status_previsao_to_engenheiros
AFTER INSERT OR UPDATE ON projetos_previsao
FOR EACH ROW
WHEN (NEW.status_id IS NOT NULL)
EXECUTE FUNCTION sync_status_previsao_to_engenheiros();

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================

SELECT '✅ Trigger de sincronização de status criado!' as mensagem;

-- Testar se o trigger existe
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_name = 'trg_sync_status_previsao_to_engenheiros';

