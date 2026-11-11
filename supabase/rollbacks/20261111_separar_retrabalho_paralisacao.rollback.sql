-- =====================================================
-- ROLLBACK de 20261111_separar_retrabalho_paralisacao.sql
-- =====================================================
-- Remove as duas views novas e a constraint do tipo, e devolve
-- vw_retrabalho_detalhes_projeto sem a coluna tipo_retrabalho.
--
-- Nao apaga dado: o tipo ja gravado em retrabalho_projetos.tipo_retrabalho
-- continua la (a coluna e anterior a esta migration).
--
-- Fazer o rollback do codigo (dashboard) ANTES: o dashboard novo le as views
-- novas e a coluna tipo_retrabalho.
-- =====================================================

BEGIN;

DROP VIEW IF EXISTS public.vw_ocorrencias_por_motivo;
DROP VIEW IF EXISTS public.vw_ocorrencias_motivos_por_projeto;

ALTER TABLE public.retrabalho_projetos
  DROP CONSTRAINT IF EXISTS chk_retrabalho_tipo_ocorrencia;

-- CREATE OR REPLACE nao remove coluna de view: recriar do zero, como no baseline.
DROP VIEW IF EXISTS public.vw_retrabalho_detalhes_projeto;

CREATE VIEW public.vw_retrabalho_detalhes_projeto AS
 SELECT r.id AS retrabalho_id,
    r.projeto_id,
    p.codigo_projeto,
    p.cliente,
    r.data_retrabalho,
    ep.eng_id,
    e.nome AS engenheiro_nome,
    r.motivo_retrabalho,
    ep.area_id,
    a.codigo AS area_codigo,
    a.descricao AS area_descricao,
    r.horas_trabalhadas_total,
    r.horas_retrabalho
   FROM public.retrabalho_projetos r
     JOIN public.projetos p ON p.projeto_id = r.projeto_id
     JOIN public.engenheiros_projetos ep ON ep.id = r.eng_projeto_id
     JOIN public.engenheiros e ON e.eng_id = ep.eng_id
     JOIN public.areas a ON a.area_id = ep.area_id
  WHERE r.necessitou_retrabalho = true
  ORDER BY p.codigo_projeto, a.codigo, r.data_retrabalho DESC;

REVOKE ALL ON TABLE public.vw_retrabalho_detalhes_projeto FROM PUBLIC, anon, authenticated, service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vw_retrabalho_detalhes_projeto TO service_role;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE public.vw_retrabalho_detalhes_projeto TO authenticated;

COMMIT;
