-- =====================================================
-- TRIGGER: Notificar Novo Projeto Atribuído
-- =====================================================
-- Quando um projeto é atribuído a um engenheiro,
-- cria automaticamente uma notificação pendente
-- =====================================================

CREATE OR REPLACE FUNCTION notificar_novo_projeto()
RETURNS TRIGGER AS $$
DECLARE
    v_eng_telefone VARCHAR(20);
    v_eng_nome VARCHAR(255);
    v_projeto_codigo VARCHAR(50);
    v_cliente VARCHAR(255);
    v_descricao TEXT;
    v_area_desc VARCHAR(255);
    v_mensagem TEXT;
BEGIN
    -- Buscar informações completas
    SELECT
        e.telefone,
        e.nome,
        p.codigo_projeto,
        p.cliente,
        p.descricao,
        a.descricao
    INTO
        v_eng_telefone,
        v_eng_nome,
        v_projeto_codigo,
        v_cliente,
        v_descricao,
        v_area_desc
    FROM engenheiros e
    JOIN projetos p ON p.projeto_id = NEW.projeto_id
    JOIN areas a ON a.area_id = NEW.area_id
    WHERE e.eng_id = NEW.eng_id;
    
    -- Extrair primeiro nome
    v_eng_nome := SPLIT_PART(v_eng_nome, ' ', 1);
    
    -- Montar mensagem
    v_mensagem := '🎯 *Novo Projeto Atribuído!*' || E'\n\n';
    v_mensagem := v_mensagem || 'Olá ' || v_eng_nome || '!' || E'\n\n';
    v_mensagem := v_mensagem || '📋 *Projeto:* ' || v_projeto_codigo || E'\n';
    v_mensagem := v_mensagem || '👤 *Cliente:* ' || v_cliente || E'\n';
    
    IF v_descricao IS NOT NULL THEN
        v_mensagem := v_mensagem || '📝 *Descrição:* ' || v_descricao || E'\n';
    END IF;
    
    v_mensagem := v_mensagem || '📦 *Área:* ' || v_area_desc || E'\n\n';

    IF NEW.data_inicio IS NOT NULL THEN
        v_mensagem := v_mensagem || '📅 *Início:* ' || TO_CHAR(NEW.data_inicio, 'DD/MM/YYYY') || E'\n';
    END IF;

    IF NEW.data_prevista IS NOT NULL THEN
        v_mensagem := v_mensagem || '⏰ *Prazo:* ' || TO_CHAR(NEW.data_prevista, 'DD/MM/YYYY') || E'\n';
    END IF;
    
    v_mensagem := v_mensagem || E'\n';
    v_mensagem := v_mensagem || '_Digite "menu" para visualizar os detalhes_';
    
    -- Inserir notificação pendente
    INSERT INTO notificacoes_whatsapp (
        eng_id,
        telefone,
        tipo,
        titulo,
        mensagem,
        projeto_id,
        eng_projeto_id,
        enviada,
        data_agendamento
    ) VALUES (
        NEW.eng_id,
        v_eng_telefone,
        'novo_projeto',
        'Novo Projeto Atribuído',
        v_mensagem,
        NEW.projeto_id,
        NEW.id,
        false,
        NOW()
    );
    
    RAISE NOTICE 'Notificação criada para engenheiro % - Projeto %', v_eng_nome, v_projeto_codigo;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log do erro mas não bloqueia a inserção do projeto
        RAISE WARNING 'Erro ao criar notificação de novo projeto: %', SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION notificar_novo_projeto IS 'Cria notificação automática quando projeto é atribuído a engenheiro';

-- Drop trigger se já existir
DROP TRIGGER IF EXISTS trg_notificar_novo_projeto ON engenheiros_projetos;

-- Criar trigger
CREATE TRIGGER trg_notificar_novo_projeto
AFTER INSERT ON engenheiros_projetos
FOR EACH ROW
EXECUTE FUNCTION notificar_novo_projeto();

COMMENT ON TRIGGER trg_notificar_novo_projeto ON engenheiros_projetos IS 'Notifica engenheiro quando novo projeto é atribuído';

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================

SELECT '✅ Trigger de notificação de novo projeto criado!' as mensagem;

-- Verificar se o trigger existe
SELECT 
    trigger_name,
    event_manipulation as evento,
    event_object_table as tabela,
    action_timing as quando
FROM information_schema.triggers
WHERE trigger_name = 'trg_notificar_novo_projeto';

