-- =====================================================
-- ROLLBACK de 20261022_authenticated_somente_leitura.sql — SO EM EMERGENCIA
-- =====================================================
-- Devolve a authenticated a escrita em todas as tabelas e o EXECUTE nas 28
-- funcoes de escrita. Use so se algo legitimo parar de funcionar, e so ate
-- corrigir.
--
-- transferir_atribuicao e desativar_atribuicao NAO voltam para authenticated:
-- desde 20260703 elas sao so service_role de proposito.
-- =====================================================

BEGIN;

GRANT INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, UPDATE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS assinatura
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'ajustar_residuo_pesos', 'atribuir_area_projeto', 'atualizar_engenheiro',
        'atualizar_feito_dia', 'atualizar_previsao', 'atualizar_status_projeto',
        'cadastrar_engenheiro', 'configurar_pavimentos_customizados_area',
        'criar_atualizar_prazos', 'criar_projeto', 'dashboard_atribuir_projeto_com_pavimentos',
        'desativar_projeto_completo', 'dono_distribuir_projeto_com_prazos',
        'dono_distribuir_tarefa', 'gerar_proximo_codigo_projeto', 'limpar_projetos_finalizados_antigos',
        'marcar_area_concluida', 'marcar_notificacao_enviada', 'marcar_projeto_concluido',
        'processar_fila_notificacoes', 'processar_prompt_chatbot', 'recalcular_rollup_projeto',
        'registrar_previsao_dia', 'registrar_retrabalho', 'registrar_retrabalho_dia',
        'seed_pavimentos_etapas'
      )
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated;', r.assinatura);
  END LOOP;
END $$;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT INSERT, UPDATE, DELETE, TRUNCATE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT USAGE, UPDATE ON SEQUENCES TO authenticated;

COMMIT;
