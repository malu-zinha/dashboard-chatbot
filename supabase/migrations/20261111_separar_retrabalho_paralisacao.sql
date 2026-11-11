-- =====================================================
-- MIGRACAO: separar retrabalho e paralisacao nos motivos
-- =====================================================
-- APLICAR ANTES DO DEPLOY: o dashboard novo le as views novas e a coluna
-- tipo_retrabalho de vw_retrabalho_detalhes_projeto. O codigo antigo nao usa
-- nada disto, entao aplicar antes nao quebra nada.
--
-- Contexto: o bot passa a perguntar se foi retrabalho ou paralisacao e grava
-- 'retrabalho' ou 'paralisacao' em retrabalho_projetos.tipo_retrabalho (a
-- coluna ja existia e estava sempre NULL; a RPC registrar_retrabalho_dia ja
-- grava p_tipo_retrabalho). Os dois usam os mesmos 6 motivos.
--
-- O que muda:
--   1. Constraint chk_retrabalho_tipo_ocorrencia: tipo_retrabalho so aceita
--      NULL, 'retrabalho' ou 'paralisacao'. NOT VALID: protege so as linhas
--      novas; as antigas nao sao conferidas nem alteradas.
--   2. Views NOVAS (as antigas continuam iguais, entao o dashboard que esta no
--      ar segue funcionando ate o deploy):
--        - vw_ocorrencias_por_motivo: motivos da TecPred inteira, por tipo;
--        - vw_ocorrencias_motivos_por_projeto: o mesmo, por projeto.
--      tipo = 'retrabalho' | 'paralisacao' | 'nao_classificado'. Registro
--      antigo (tipo_retrabalho NULL) aparece como 'nao_classificado'.
--   3. vw_retrabalho_detalhes_projeto ganha a coluna tipo_retrabalho NO FIM
--      (as colunas que ja existiam ficam iguais e na mesma ordem).
--
-- Nao altera nem apaga dado nenhum.
-- Conferir: secao 4.
-- Desfazer: supabase/rollbacks/20261111_separar_retrabalho_paralisacao.rollback.sql
-- =====================================================

BEGIN;

-- -----------------------------------------------------
-- 1. Tipo so aceita os dois valores do bot (linhas novas)
-- -----------------------------------------------------
ALTER TABLE public.retrabalho_projetos
  DROP CONSTRAINT IF EXISTS chk_retrabalho_tipo_ocorrencia;

ALTER TABLE public.retrabalho_projetos
  ADD CONSTRAINT chk_retrabalho_tipo_ocorrencia
    CHECK (tipo_retrabalho IS NULL OR tipo_retrabalho IN ('retrabalho', 'paralisacao'))
    NOT VALID;

-- -----------------------------------------------------
-- 2. Motivos separados por tipo
-- -----------------------------------------------------
-- Mesmas colunas e filtros de vw_dono_retrabalhos_por_motivo, mais o tipo.
CREATE OR REPLACE VIEW public.vw_ocorrencias_por_motivo AS
 SELECT COALESCE(tipo_retrabalho, 'nao_classificado') AS tipo,
    motivo_retrabalho,
    count(*) AS quantidade,
    count(DISTINCT eng_id) AS engenheiros_afetados,
    count(DISTINCT projeto_id) AS projetos_afetados,
    COALESCE(sum(COALESCE(horas_retrabalho, 0::numeric)), 0::numeric) AS horas_retrabalho_total
   FROM public.retrabalho_projetos
  WHERE necessitou_retrabalho = true AND motivo_retrabalho IS NOT NULL
  GROUP BY COALESCE(tipo_retrabalho, 'nao_classificado'), motivo_retrabalho
  ORDER BY COALESCE(tipo_retrabalho, 'nao_classificado'), (count(*)) DESC;

-- Mesmas colunas e filtros de vw_retrabalho_motivos_por_projeto, mais o tipo.
CREATE OR REPLACE VIEW public.vw_ocorrencias_motivos_por_projeto AS
 SELECT p.projeto_id,
    p.codigo_projeto,
    p.cliente,
    COALESCE(r.tipo_retrabalho, 'nao_classificado') AS tipo,
    r.motivo_retrabalho,
    count(*) AS quantidade,
    COALESCE(sum(COALESCE(r.horas_retrabalho, 0::numeric)), 0::numeric) AS horas_retrabalho_total
   FROM public.retrabalho_projetos r
     JOIN public.projetos p ON p.projeto_id = r.projeto_id
  WHERE r.necessitou_retrabalho = true AND r.motivo_retrabalho IS NOT NULL
  GROUP BY p.projeto_id, p.codigo_projeto, p.cliente, COALESCE(r.tipo_retrabalho, 'nao_classificado'), r.motivo_retrabalho
  ORDER BY p.codigo_projeto, COALESCE(r.tipo_retrabalho, 'nao_classificado'), (count(*)) DESC;

-- -----------------------------------------------------
-- 3. Detalhes por projeto: tipo no fim
-- -----------------------------------------------------
CREATE OR REPLACE VIEW public.vw_retrabalho_detalhes_projeto AS
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
    r.horas_retrabalho,
    r.tipo_retrabalho
   FROM public.retrabalho_projetos r
     JOIN public.projetos p ON p.projeto_id = r.projeto_id
     JOIN public.engenheiros_projetos ep ON ep.id = r.eng_projeto_id
     JOIN public.engenheiros e ON e.eng_id = ep.eng_id
     JOIN public.areas a ON a.area_id = ep.area_id
  WHERE r.necessitou_retrabalho = true
  ORDER BY p.codigo_projeto, a.codigo, r.data_retrabalho DESC;

-- -----------------------------------------------------
-- Permissoes das views novas: iguais as das views de origem
-- (authenticated so le; anon nao ve nada)
-- -----------------------------------------------------
REVOKE ALL ON TABLE public.vw_ocorrencias_por_motivo FROM PUBLIC, anon, authenticated, service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vw_ocorrencias_por_motivo TO service_role;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE public.vw_ocorrencias_por_motivo TO authenticated;

REVOKE ALL ON TABLE public.vw_ocorrencias_motivos_por_projeto FROM PUBLIC, anon, authenticated, service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vw_ocorrencias_motivos_por_projeto TO service_role;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE public.vw_ocorrencias_motivos_por_projeto TO authenticated;

COMMIT;

-- -----------------------------------------------------
-- 4. Conferencia (so leitura, rodar depois do COMMIT)
-- -----------------------------------------------------
-- a) Hoje todos os registros antigos sao 'nao_classificado' (deve voltar 1
--    linha so, com tipo = nao_classificado):
--   SELECT tipo, sum(quantidade) AS registros
--   FROM public.vw_ocorrencias_por_motivo
--   GROUP BY tipo;
--
-- b) A view nova soma o mesmo que a antiga (deve voltar diferenca = 0):
--   SELECT
--     (SELECT sum(quantidade) FROM public.vw_dono_retrabalhos_por_motivo)
--     - (SELECT sum(quantidade) FROM public.vw_ocorrencias_por_motivo) AS diferenca;
--
-- c) Por projeto, idem (deve voltar diferenca = 0):
--   SELECT
--     (SELECT sum(quantidade) FROM public.vw_retrabalho_motivos_por_projeto)
--     - (SELECT sum(quantidade) FROM public.vw_ocorrencias_motivos_por_projeto) AS diferenca;
--
-- d) Detalhes ganhou a coluna (deve voltar 1 linha: tipo_retrabalho):
--   SELECT column_name
--   FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'vw_retrabalho_detalhes_projeto'
--     AND column_name = 'tipo_retrabalho';
--
-- e) Constraint criada (deve voltar 1 linha, convalidated = false):
--   SELECT conname, convalidated
--   FROM pg_constraint
--   WHERE conname = 'chk_retrabalho_tipo_ocorrencia';
--
-- f) Permissoes (deve voltar false, true, true):
--   SELECT
--     has_table_privilege('anon', 'public.vw_ocorrencias_por_motivo', 'SELECT') AS anon,
--     has_table_privilege('authenticated', 'public.vw_ocorrencias_por_motivo', 'SELECT') AS authenticated,
--     has_table_privilege('authenticated', 'public.vw_ocorrencias_motivos_por_projeto', 'SELECT') AS authenticated_projeto;
