-- =====================================================
-- APLICAR AGORA: Fix Sincronização de Status
-- =====================================================
-- Este script corrige o problema do status não sincronizar
-- entre projetos_previsao e engenheiros_projetos
-- =====================================================

-- 1. Função de sincronização (já deve existir, mas vamos recriar)
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

-- 2. Remove trigger antigo
DROP TRIGGER IF EXISTS trg_sync_status_previsao_to_engenheiros ON projetos_previsao;

-- 3. Cria trigger NOVO que funciona em INSERT E UPDATE (captura upserts!)
CREATE TRIGGER trg_sync_status_previsao_to_engenheiros
AFTER INSERT OR UPDATE ON projetos_previsao
FOR EACH ROW
WHEN (NEW.status_id IS NOT NULL)
EXECUTE FUNCTION sync_status_previsao_to_engenheiros();

-- =====================================================
-- TESTE MANUAL
-- =====================================================

-- Simular uma previsão matinal com status
DO $$
DECLARE
    v_eng_projeto_id UUID;
    v_projeto_id UUID;
    v_eng_id UUID;
BEGIN
    -- Pegar primeira atribuição ativa
    SELECT id, projeto_id, eng_id
    INTO v_eng_projeto_id, v_projeto_id, v_eng_id
    FROM engenheiros_projetos
    WHERE ativo = true
    LIMIT 1;
    
    IF v_eng_projeto_id IS NOT NULL THEN
        -- Inserir previsão com status_id = 3 (exemplo)
        INSERT INTO projetos_previsao (
            eng_projeto_id,
            projeto_id,
            eng_id,
            data_registro,
            previsao_texto,
            status_id,
            editavel
        ) VALUES (
            v_eng_projeto_id,
            v_projeto_id,
            v_eng_id,
            CURRENT_DATE,
            'Teste de sincronização de status',
            3, -- Status: EM_ANDAMENTO_50 ou outro
            true
        )
        ON CONFLICT (eng_projeto_id, data_registro) 
        DO UPDATE SET 
            status_id = 3,
            previsao_texto = 'Teste de sincronização de status - ATUALIZADO',
            updated_at = NOW();
        
        RAISE NOTICE 'Teste executado para eng_projeto_id: %', v_eng_projeto_id;
    ELSE
        RAISE NOTICE 'Nenhuma atribuição ativa encontrada para teste';
    END IF;
END $$;

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================

SELECT '✅ Trigger de sincronização de status ATUALIZADO!' as mensagem;

-- Verificar se o trigger existe e está configurado corretamente
SELECT 
    trigger_name,
    event_object_table as tabela,
    action_timing as quando,
    string_agg(event_manipulation, ', ') as eventos
FROM information_schema.triggers
WHERE trigger_name = 'trg_sync_status_previsao_to_engenheiros'
GROUP BY trigger_name, event_object_table, action_timing;

-- Verificar se o status foi sincronizado no teste
SELECT 
    ep.id,
    ep.status_id as status_engenheiros_projetos,
    pp.status_id as status_previsao,
    sc.descricao as status_descricao,
    pp.previsao_texto,
    pp.created_at
FROM engenheiros_projetos ep
JOIN projetos_previsao pp ON pp.eng_projeto_id = ep.id
LEFT JOIN status_codes sc ON sc.status_id = ep.status_id
WHERE pp.data_registro = CURRENT_DATE
ORDER BY pp.created_at DESC
LIMIT 5;

