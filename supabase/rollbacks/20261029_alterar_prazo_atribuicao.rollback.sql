-- =====================================================
-- ROLLBACK de 20261029_alterar_prazo_atribuicao.sql
-- =====================================================
-- Remove a funcao alterar_prazo_atribuicao, os dois indices e as seis colunas
-- novas de notificacoes_whatsapp.
--
-- ATENCAO: o que foi gravado nessas colunas se perde (de qual atribuicao era
-- cada aviso, o SID do Twilio, o status de entrega e o prazo avisado). Os avisos em si (linhas
-- de notificacoes_whatsapp) e os prazos ja alterados continuam como estao.
--
-- Fazer o rollback do codigo (bot e dashboard) ANTES: o codigo novo chama a
-- funcao e le essas colunas.
-- =====================================================

BEGIN;

DROP FUNCTION IF EXISTS public.alterar_prazo_atribuicao(uuid, date, uuid);

DROP INDEX IF EXISTS public.idx_notif_twilio_sid;
DROP INDEX IF EXISTS public.idx_notif_eng_projeto_tipo;

ALTER TABLE public.notificacoes_whatsapp
  DROP COLUMN IF EXISTS eng_projeto_id,
  DROP COLUMN IF EXISTS twilio_sid,
  DROP COLUMN IF EXISTS status_entrega,
  DROP COLUMN IF EXISTS erro_codigo,
  DROP COLUMN IF EXISTS status_atualizado_em,
  DROP COLUMN IF EXISTS prazo_avisado;

COMMIT;
