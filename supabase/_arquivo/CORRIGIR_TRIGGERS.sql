-- =====================================================
-- 🔧 CORREÇÃO: Separar sincronização e notificação
-- Cole este código no SQL Editor do Supabase
-- =====================================================

-- 1. DROP triggers e function antigos
DROP TRIGGER IF EXISTS trg_sincronizar_task ON evandro_distribuicao_tasks;
DROP TRIGGER IF EXISTS trg_notificar_task ON evandro_distribuicao_tasks;
DROP FUNCTION IF EXISTS sincronizar_task_para_engenheiro();
DROP FUNCTION IF EXISTS notificar_task_criada();

-- 2. FUNCTION NOVA: Sincroniza ANTES do INSERT (sem notificação)
-- ATENCAO: esta definicao esta DESATUALIZADA e nao deve sobrescrever a de
-- supabase/migrations/20261004_observacoes_e_feito_do_dia.sql, que e a vigente.
-- Alem do carimbo de atribuicao (que agora vai para a coluna atribuido_por, nao
-- para observacoes), a versao abaixo tambem nao conhece instancia_label nem
-- complemento_area_ref_id. Aplicar este arquivo depois das migrations reverte
-- as duas coisas. Mantido so como historico.
CREATE OR REPLACE FUNCTION sincronizar_task_para_engenheiro()
RETURNS TRIGGER AS $$
DECLARE
    v_projeto_id UUID;
    v_eng_projeto_id UUID;
    v_status_id INTEGER;
BEGIN
    -- Só sincroniza se ainda não foi sincronizado
    IF NEW.sincronizado = false THEN
        
        -- 1. Criar projeto se não existir
        IF NEW.projeto_id IS NULL AND NEW.codigo_projeto IS NOT NULL THEN
            INSERT INTO projetos (codigo_projeto, cliente)
            VALUES (NEW.codigo_projeto, NEW.cliente)
            ON CONFLICT (codigo_projeto) DO NOTHING
            RETURNING projeto_id INTO v_projeto_id;
            
            -- Se não retornou (conflito), busca o existente
            IF v_projeto_id IS NULL THEN
                SELECT projeto_id INTO v_projeto_id
                FROM projetos
                WHERE codigo_projeto = NEW.codigo_projeto
                LIMIT 1;
            END IF;
            
            NEW.projeto_id := v_projeto_id;
        ELSE
            v_projeto_id := NEW.projeto_id;
        END IF;
        
        -- 2. Busca status inicial
        SELECT status_id INTO v_status_id
        FROM status_codes
        WHERE codigo = 'AGUARDANDO_INICIO'
        LIMIT 1;
        
        -- 3. Criar atribuição em engenheiros_projetos
        INSERT INTO engenheiros_projetos (
            eng_id,
            projeto_id,
            area_id,
            data_inicio,
            data_prevista,
            status_id,
            atribuido_por
        ) VALUES (
            NEW.eng_id,
            v_projeto_id,
            NEW.area_id,
            COALESCE(NEW.data_inicio_prevista, CURRENT_DATE),
            NEW.data_conclusao_prevista,
            v_status_id,
            'Atribuído por: ' || COALESCE(
                (SELECT nome FROM dono_empresa WHERE dono_id = NEW.dono_id),
                'Sistema'
            )
        ) RETURNING id INTO v_eng_projeto_id;
        
        -- 4. Atualiza a task com referência
        NEW.eng_projeto_id := v_eng_projeto_id;
        NEW.sincronizado := true;
        NEW.data_sincronizacao := NOW();
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION sincronizar_task_para_engenheiro IS 'Sincroniza tasks com engenheiros_projetos - BEFORE INSERT';

-- 3. FUNCTION NOVA: Cria notificação DEPOIS do INSERT
CREATE OR REPLACE FUNCTION notificar_task_criada()
RETURNS TRIGGER AS $$
DECLARE
    v_telefone TEXT;
    v_codigo_projeto TEXT;
    v_area_descricao TEXT;
BEGIN
    -- Só notifica se foi recém criada e sincronizada
    IF NEW.sincronizado = true AND NEW.notificacao_enviada = false THEN
        
        -- Busca telefone do engenheiro
        SELECT telefone INTO v_telefone
        FROM engenheiros
        WHERE eng_id = NEW.eng_id;
        
        -- Busca código do projeto
        SELECT codigo_projeto INTO v_codigo_projeto
        FROM projetos
        WHERE projeto_id = NEW.projeto_id;
        
        -- Busca descrição da área
        SELECT descricao INTO v_area_descricao
        FROM areas
        WHERE area_id = NEW.area_id;
        
        -- Cria notificação
        INSERT INTO notificacoes_whatsapp (
            eng_id,
            telefone,
            tipo,
            titulo,
            mensagem,
            task_id,
            projeto_id
        ) VALUES (
            NEW.eng_id,
            v_telefone,
            'NOVA_TAREFA',
            '🆕 Nova Tarefa Atribuída!',
            '📋 Projeto: ' || COALESCE(NEW.codigo_projeto, v_codigo_projeto, 'N/A') || 
            E'\n📦 Área: ' || COALESCE(v_area_descricao, 'N/A') ||
            E'\n📝 Descrição: ' || NEW.descricao_task ||
            E'\n📅 Início previsto: ' || COALESCE(NEW.data_inicio_prevista::TEXT, 'Não definido') ||
            E'\n⏰ Conclusão prevista: ' || COALESCE(NEW.data_conclusao_prevista::TEXT, 'Não definido'),
            NEW.task_id,
            NEW.projeto_id
        );
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION notificar_task_criada IS 'Cria notificação WhatsApp - AFTER INSERT';

-- 4. Criar TRIGGERS
CREATE TRIGGER trg_sincronizar_task
    BEFORE INSERT ON evandro_distribuicao_tasks
    FOR EACH ROW
    EXECUTE FUNCTION sincronizar_task_para_engenheiro();

CREATE TRIGGER trg_notificar_task
    AFTER INSERT ON evandro_distribuicao_tasks
    FOR EACH ROW
    EXECUTE FUNCTION notificar_task_criada();

-- =====================================================
-- ✅ PRONTO! Agora vai:
-- 1. Salvar em evandro_distribuicao_tasks
-- 2. Criar em engenheiros_projetos
-- 3. Criar notificação WhatsApp (depois que task_id existe)
-- =====================================================

