-- =====================================================
-- MIGRACAO: authenticated (usuario logado no dashboard) so le
-- =====================================================
-- !! APLICAR SO DEPOIS DO DEPLOY do commit "criar e atribuir projeto so
-- !! pelo servidor" (rotas POST /api/admin/projetos e /api/admin/atribuicoes).
-- !! Antes dele, o dashboard em producao ainda chama criar_projeto e
-- !! dashboard_atribuir_projeto_com_pavimentos do navegador, e os dois
-- !! botoes quebrariam.
--
-- Por que: a RLS de 20260601 ("for all to authenticated using (true)") e os
-- privilegios padrao davam a authenticated escrita em todas as tabelas e
-- EXECUTE em todas as funcoes — bem mais do que o dashboard precisa.
-- Principio do menor privilegio: escrita so pelo servidor.
--
-- Hoje toda escrita do dashboard passa por /api/admin/* (service role, so
-- owner) e o chatbot usa service role. O navegador so precisa LER.
--
-- O que faz:
--   0. Trava de seguranca: aborta se alguma view usar uma funcao da lista
--      (a view ficaria vazia para o usuario logado).
--   1. Tira INSERT/UPDATE/DELETE/TRUNCATE de authenticated em todas as
--      tabelas. SELECT continua (dashboard e Realtime precisam).
--   2. Tira EXECUTE de authenticated (e de PUBLIC) das 28 funcoes que
--      escrevem; service_role mantem. Funcoes de leitura (listar_*, buscar_*,
--      calcular_*, dono_consultar_*...) continuam liberadas.
--   3. Objetos futuros ja nascem sem escrita para authenticated.
--
-- Nao toca em dado nenhum. Nao muda nada para service_role (chatbot e rotas
-- admin). Aplicar depois de 20261021_fechar_acesso_anon.sql (aquela devolve
-- EXECUTE a authenticated nas funcoes abertas; esta tira das que escrevem).
--
-- Conferir: rodar a secao 4 (deve voltar vazia).
-- Desfazer: supabase/rollbacks/20261022_authenticated_somente_leitura.rollback.sql
-- =====================================================

BEGIN;

CREATE TEMP TABLE _funcoes_escrita (nome text PRIMARY KEY) ON COMMIT DROP;
INSERT INTO _funcoes_escrita (nome) VALUES
  ('ajustar_residuo_pesos'),
  ('atribuir_area_projeto'),
  ('atualizar_engenheiro'),
  ('atualizar_feito_dia'),
  ('atualizar_previsao'),
  ('atualizar_status_projeto'),
  ('cadastrar_engenheiro'),
  ('configurar_pavimentos_customizados_area'),
  ('criar_atualizar_prazos'),
  ('criar_projeto'),
  ('dashboard_atribuir_projeto_com_pavimentos'),
  ('desativar_atribuicao'),
  ('desativar_projeto_completo'),
  ('dono_distribuir_projeto_com_prazos'),
  ('dono_distribuir_tarefa'),
  ('gerar_proximo_codigo_projeto'),
  ('limpar_projetos_finalizados_antigos'),
  ('marcar_area_concluida'),
  ('marcar_notificacao_enviada'),
  ('marcar_projeto_concluido'),
  ('processar_fila_notificacoes'),
  ('processar_prompt_chatbot'),
  ('recalcular_rollup_projeto'),
  ('registrar_previsao_dia'),
  ('registrar_retrabalho'),
  ('registrar_retrabalho_dia'),
  ('seed_pavimentos_etapas'),
  ('transferir_atribuicao');

-- -----------------------------------------------------
-- 0. Trava: nenhuma view pode depender dessas funcoes
-- -----------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT c.relname AS view, f.nome AS funcao
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN _funcoes_escrita f ON pg_get_viewdef(c.oid) ~* ('\m' || f.nome || '\s*\(')
    WHERE n.nspname = 'public' AND c.relkind IN ('v', 'm')
  LOOP
    RAISE EXCEPTION 'Abortado: a view % usa a funcao %; revogar quebraria a view.', r.view, r.funcao;
  END LOOP;
END $$;

-- -----------------------------------------------------
-- 1. Tabelas: authenticated so com SELECT
-- -----------------------------------------------------
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM authenticated;
REVOKE USAGE, UPDATE ON ALL SEQUENCES IN SCHEMA public FROM authenticated;

-- -----------------------------------------------------
-- 2. Funcoes que escrevem: so service_role
-- -----------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS assinatura
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN _funcoes_escrita f ON f.nome = p.proname
    WHERE n.nspname = 'public'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated;', r.assinatura);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role;', r.assinatura);
  END LOOP;
END $$;

-- -----------------------------------------------------
-- 3. Objetos futuros
-- -----------------------------------------------------
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLES FROM authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE USAGE, UPDATE ON SEQUENCES FROM authenticated;

COMMIT;

-- -----------------------------------------------------
-- 4. Conferencia (so leitura) — deve voltar ZERO linhas
-- -----------------------------------------------------
SELECT 'tabela com escrita' AS problema, c.relname AS objeto
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'p')
  AND has_table_privilege('authenticated', c.oid, 'INSERT, UPDATE, DELETE, TRUNCATE')
UNION ALL
SELECT 'funcao de escrita executavel', p.oid::regprocedure::text
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'ajustar_residuo_pesos', 'atribuir_area_projeto', 'atualizar_engenheiro',
    'atualizar_feito_dia', 'atualizar_previsao', 'atualizar_status_projeto',
    'cadastrar_engenheiro', 'configurar_pavimentos_customizados_area',
    'criar_atualizar_prazos', 'criar_projeto', 'dashboard_atribuir_projeto_com_pavimentos',
    'desativar_atribuicao', 'desativar_projeto_completo', 'dono_distribuir_projeto_com_prazos',
    'dono_distribuir_tarefa', 'gerar_proximo_codigo_projeto', 'limpar_projetos_finalizados_antigos',
    'marcar_area_concluida', 'marcar_notificacao_enviada', 'marcar_projeto_concluido',
    'processar_fila_notificacoes', 'processar_prompt_chatbot', 'recalcular_rollup_projeto',
    'registrar_previsao_dia', 'registrar_retrabalho', 'registrar_retrabalho_dia',
    'seed_pavimentos_etapas', 'transferir_atribuicao'
  )
  AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
UNION ALL
-- Sanidade no sentido oposto: o dashboard ainda precisa ler as views.
SELECT 'view SEM leitura para authenticated', c.relname
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'v'
  AND NOT has_table_privilege('authenticated', c.oid, 'SELECT');
