-- =====================================================
-- DEFINIR O OWNER DO DASHBOARD (projeto Supabase novo)
-- =====================================================
-- A migration 20260601_auth_dashboard.sql marca como owner um UUID fixo, que
-- so existe no projeto de producao. Num projeto novo esse insert nao acha
-- ninguem e o dashboard nasce sem owner: /admin fica inacessivel.
--
-- Como usar:
--   1. Authentication -> Users -> Add user: crie o usuario com o email do dono.
--   2. Troque o email na linha marcada abaixo e rode no SQL Editor.
--
-- Grava UMA linha em user_profiles (cria ou promove a owner ativo). Em
-- producao, so rode de proposito: da acesso total ao /admin para o email.
-- =====================================================

DO $$
DECLARE
  v_email text := 'dono@exemplo.com';  -- <<< troque pelo email do dono
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM auth.users WHERE lower(email) = lower(v_email);
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum usuario com o email % em Authentication -> Users. Crie o usuario antes.', v_email;
  END IF;

  INSERT INTO public.user_profiles (user_id, email, display_name, role, status, created_by)
  VALUES (v_id, v_email, split_part(v_email, '@', 1), 'owner', 'active', v_id)
  ON CONFLICT (user_id) DO UPDATE
    SET role = 'owner', status = 'active', updated_at = now();

  RAISE NOTICE 'Owner ativo: % (%)', v_email, v_id;
END $$;

-- Conferir:
-- SELECT email, role, status FROM public.user_profiles WHERE role = 'owner';
