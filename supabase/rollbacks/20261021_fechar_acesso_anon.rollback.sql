-- =====================================================
-- ROLLBACK de 20261021_fechar_acesso_anon.sql — SO EM EMERGENCIA
-- =====================================================
-- Devolve ao anon os privilegios que a migration tirou. Use apenas se alguma
-- tela parar de funcionar por causa dela, e so ate corrigir a tela.
--
-- Devolve: SELECT nas views que o anon tinha em 21/10/2026 e os privilegios
-- padrao do Supabase para objetos futuros. As funcoes voltam a ser
-- executaveis por PUBLIC (padrao do Postgres) — o que a migration tirou delas.
-- =====================================================

BEGIN;

GRANT SELECT ON
  vw_atribuicao_apontamentos,
  vw_bloco1_visao_geral,
  vw_bloco3_carga_trabalho,
  vw_bloco4_execucao_media,
  vw_dashboard_producao_apontamentos,
  vw_grafico_carga_trabalho,
  vw_grafico_projetos_status,
  vw_projetos_detalhado,
  vw_relatorio_disciplinas_projeto,
  vw_relatorio_projeto_pdf,
  vw_retrabalho_detalhes_projeto,
  vw_retrabalho_geral,
  vw_retrabalho_por_projeto,
  vw_retrabalho_taxa_area_projeto
TO anon;

-- Funcoes: a migration trocou PUBLIC por authenticated + service_role nas que
-- estavam abertas. Devolver a PUBLIC restaura o comportamento anterior.
-- ATENCAO: nao rode em transferir_atribuicao / desativar_atribuicao, que ja
-- eram restritas desde 20260703; o loop abaixo pula as duas.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS assinatura
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind IN ('f', 'p')
      AND p.proname NOT IN ('transferir_atribuicao', 'desativar_atribuicao')
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO PUBLIC;', r.assinatura);
  END LOOP;
END $$;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO PUBLIC;

COMMIT;
