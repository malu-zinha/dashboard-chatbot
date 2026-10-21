-- =====================================================
-- MIGRACAO: fechar todo acesso do papel anon (nao logado)
-- =====================================================
-- O papel anon (chave publishable, sem login) nao tem uso legitimo neste
-- projeto: o dashboard le com a sessao do usuario (authenticated) e o chatbot
-- usa a service role. Varias views ainda tinham privilegio para anon.
--
-- Causa: 20260601_auth_dashboard.sql fechou o anon UMA vez, num loop sobre
-- as views que existiam naquele dia. Toda view recriada depois (DROP +
-- CREATE em 0606, 0630, 0702, 0703, 0901, 1004) nasceu com os privilegios
-- padrao do Supabase, que dao SELECT ao anon. 20261004 ainda deu GRANT
-- explicito ao anon, achando que o dashboard le como anon — nao le: o
-- cliente do navegador manda a sessao do usuario e entra como authenticated.
--
-- O que esta migration faz:
--   1. Tira do anon todo privilegio em tabelas, views, matviews e sequences.
--   2. Funcoes: tira o EXECUTE do anon. Nas que estavam abertas a PUBLIC
--      (o padrao do Postgres), troca PUBLIC por authenticated + service_role
--      — quem esta logado continua podendo exatamente o que podia.
--      Funcoes ja restritas (ex.: transferir_atribuicao) nao ganham nada.
--   3. Muda os privilegios padrao do role postgres (quem roda o SQL Editor)
--      para que objetos criados daqui para frente ja nascam sem anon.
--
-- O que NAO faz (de proposito):
--   - Nao toca em dado nenhum.
--   - Nao muda nada para authenticated nem service_role.
--   - Nao liga security_invoker nas views: com a RLS atual (authenticated le
--     tudo) nao mudaria nada para o usuario logado, e uma tabela com RLS sem
--     policy esvaziaria a view. Fica para quando a RLS for apertada.
--
-- Aplicar: colar inteiro no SQL Editor e rodar. Idempotente.
-- Conferir: rodar a consulta da secao 4 (deve voltar vazia).
-- Desfazer: supabase/rollbacks/20261021_fechar_acesso_anon.rollback.sql
-- =====================================================

BEGIN;

-- -----------------------------------------------------
-- 1. Relacoes: tabelas, views, matviews, sequences
-- -----------------------------------------------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;      -- inclui views
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;

DO $$
DECLARE
  r record;
BEGIN
  -- "ALL TABLES" nao cobre materialized views.
  FOR r IN SELECT matviewname FROM pg_matviews WHERE schemaname = 'public' LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon;', r.matviewname);
  END LOOP;
END $$;

-- -----------------------------------------------------
-- 2. Funcoes
-- -----------------------------------------------------
-- proacl NULL = privilegio padrao do Postgres (EXECUTE para PUBLIC).
-- grantee 0 no aclexplode = PUBLIC. anon herda de PUBLIC, entao so revogar
-- do anon nao basta: tem que tirar o PUBLIC e devolver o acesso a quem
-- tinha de fato (authenticated e service_role).
DO $$
DECLARE
  r record;
  aberta_a_public boolean;
BEGIN
  FOR r IN
    SELECT p.oid, p.oid::regprocedure AS assinatura, p.proacl
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind IN ('f', 'p')
      -- funcoes de extensao instaladas em public nao sao nossas
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.objid = p.oid AND d.deptype = 'e'
      )
  LOOP
    aberta_a_public := r.proacl IS NULL OR EXISTS (
      SELECT 1 FROM aclexplode(r.proacl) a
      WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'
    );

    BEGIN
      IF aberta_a_public THEN
        EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC;', r.assinatura);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role;', r.assinatura);
      END IF;
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon;', r.assinatura);
    EXCEPTION WHEN insufficient_privilege THEN
      -- funcao de outro dono (ex.: supabase_admin): avisa e segue
      RAISE NOTICE 'sem permissao para alterar %, pulada', r.assinatura;
    END;
  END LOOP;
END $$;

-- -----------------------------------------------------
-- 3. Privilegios padrao para objetos futuros
-- -----------------------------------------------------
-- Sem isto, a proxima view recriada volta a abrir para o anon — foi
-- exatamente o que aconteceu depois de 20260601.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

COMMIT;

-- -----------------------------------------------------
-- 4. Conferencia (so leitura) — deve voltar ZERO linhas
-- -----------------------------------------------------
SELECT 'relacao' AS tipo, c.relname AS objeto
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'v', 'm', 'p', 'f')
  AND has_table_privilege('anon', c.oid, 'SELECT, INSERT, UPDATE, DELETE')
UNION ALL
SELECT 'funcao', p.oid::regprocedure::text
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prokind IN ('f', 'p')
  AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
  AND has_function_privilege('anon', p.oid, 'EXECUTE');
