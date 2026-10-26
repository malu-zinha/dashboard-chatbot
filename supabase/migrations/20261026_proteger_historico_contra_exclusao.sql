-- =====================================================
-- MIGRACAO: apagar uma atribuicao (ou engenheiro/projeto) nao leva o historico junto
-- =====================================================
-- Hoje (testado no baseline de 26/10/2026, num Postgres local):
--   - apagar uma ATRIBUICAO (engenheiros_projetos) apaga junto, sem aviso,
--     as horas apontadas (retrabalho_projetos), os relatos e previsoes
--     (projetos_previsao) e os prazos dela;
--   - apagar um engenheiro ou projeto que so tem atribuicoes (sem horas)
--     apaga as atribuicoes junto;
--   - engenheiro ou projeto COM horas ja era barrado (retrabalho_projetos
--     tem chave direta para eles, sem cascata).
-- Isso acontece, por exemplo, apagando uma linha no Table Editor.
--
-- O sistema nunca precisa disso: o "excluir" do bot e do dashboard so
-- DESATIVA (ativo = false). A unica funcao que apaga de proposito,
-- limpar_projetos_finalizados_antigos (cron desligado por padrao), apaga os
-- filhos um a um, pelo projeto_id, antes do projeto — testada com esta
-- migration aplicada, continua funcionando.
--
-- Agora essas cinco chaves passam a RESTRICT: apagar atribuicao com
-- historico, ou engenheiro/projeto com atribuicoes, da erro e nada some.
-- Atribuicao sem historico continua podendo ser apagada.
--
-- Continuam em cascata, de proposito:
--   - status_historico (a limpeza conta com isso);
--   - estrutura de pavimentos e etapas (criar_projeto e a atribuicao do
--     dashboard recriam essa estrutura);
--   - templates de area e user_profiles.
--
-- Nao altera nem apaga dado nenhum: so troca a regra de exclusao. As chaves
-- sao conferidas de novo contra as linhas atuais (ja validas pela chave antiga;
-- as tabelas sao pequenas, leva milissegundos).
-- Conferir: secao 2 (deve voltar 5 linhas com regra RESTRICT).
-- Desfazer: supabase/rollbacks/20261026_proteger_historico_contra_exclusao.rollback.sql
-- =====================================================

BEGIN;

-- -----------------------------------------------------
-- 1. CASCADE -> RESTRICT
-- -----------------------------------------------------
ALTER TABLE engenheiros_projetos
  DROP CONSTRAINT engenheiros_projetos_eng_id_fkey,
  ADD CONSTRAINT engenheiros_projetos_eng_id_fkey
    FOREIGN KEY (eng_id) REFERENCES engenheiros(eng_id) ON DELETE RESTRICT;

ALTER TABLE engenheiros_projetos
  DROP CONSTRAINT engenheiros_projetos_projeto_id_fkey,
  ADD CONSTRAINT engenheiros_projetos_projeto_id_fkey
    FOREIGN KEY (projeto_id) REFERENCES projetos(projeto_id) ON DELETE RESTRICT;

ALTER TABLE retrabalho_projetos
  DROP CONSTRAINT retrabalho_projetos_eng_projeto_id_fkey,
  ADD CONSTRAINT retrabalho_projetos_eng_projeto_id_fkey
    FOREIGN KEY (eng_projeto_id) REFERENCES engenheiros_projetos(id) ON DELETE RESTRICT;

ALTER TABLE projetos_previsao
  DROP CONSTRAINT projetos_previsao_eng_projeto_id_fkey,
  ADD CONSTRAINT projetos_previsao_eng_projeto_id_fkey
    FOREIGN KEY (eng_projeto_id) REFERENCES engenheiros_projetos(id) ON DELETE RESTRICT;

ALTER TABLE prazos
  DROP CONSTRAINT prazos_eng_projeto_id_fkey,
  ADD CONSTRAINT prazos_eng_projeto_id_fkey
    FOREIGN KEY (eng_projeto_id) REFERENCES engenheiros_projetos(id) ON DELETE RESTRICT;

COMMIT;

-- -----------------------------------------------------
-- 2. Conferencia (so leitura) — deve voltar 5 linhas, todas RESTRICT
-- -----------------------------------------------------
SELECT conrelid::regclass AS tabela, conname AS chave,
       CASE confdeltype WHEN 'r' THEN 'RESTRICT' WHEN 'c' THEN 'CASCADE' ELSE confdeltype::text END AS ao_apagar
FROM pg_constraint
WHERE conname IN (
  'engenheiros_projetos_eng_id_fkey', 'engenheiros_projetos_projeto_id_fkey',
  'retrabalho_projetos_eng_projeto_id_fkey', 'projetos_previsao_eng_projeto_id_fkey',
  'prazos_eng_projeto_id_fkey'
)
ORDER BY 1, 2;
