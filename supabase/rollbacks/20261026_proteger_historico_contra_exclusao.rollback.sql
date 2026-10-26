-- =====================================================
-- ROLLBACK de 20261026_proteger_historico_contra_exclusao.sql
-- =====================================================
-- Volta as cinco chaves para ON DELETE CASCADE (como no baseline de
-- 26/10/2026). Apagar engenheiro ou projeto volta a apagar o historico junto.
-- Nao altera dado nenhum.
-- =====================================================

BEGIN;

ALTER TABLE engenheiros_projetos
  DROP CONSTRAINT engenheiros_projetos_eng_id_fkey,
  ADD CONSTRAINT engenheiros_projetos_eng_id_fkey
    FOREIGN KEY (eng_id) REFERENCES engenheiros(eng_id) ON DELETE CASCADE;

ALTER TABLE engenheiros_projetos
  DROP CONSTRAINT engenheiros_projetos_projeto_id_fkey,
  ADD CONSTRAINT engenheiros_projetos_projeto_id_fkey
    FOREIGN KEY (projeto_id) REFERENCES projetos(projeto_id) ON DELETE CASCADE;

ALTER TABLE retrabalho_projetos
  DROP CONSTRAINT retrabalho_projetos_eng_projeto_id_fkey,
  ADD CONSTRAINT retrabalho_projetos_eng_projeto_id_fkey
    FOREIGN KEY (eng_projeto_id) REFERENCES engenheiros_projetos(id) ON DELETE CASCADE;

ALTER TABLE projetos_previsao
  DROP CONSTRAINT projetos_previsao_eng_projeto_id_fkey,
  ADD CONSTRAINT projetos_previsao_eng_projeto_id_fkey
    FOREIGN KEY (eng_projeto_id) REFERENCES engenheiros_projetos(id) ON DELETE CASCADE;

ALTER TABLE prazos
  DROP CONSTRAINT prazos_eng_projeto_id_fkey,
  ADD CONSTRAINT prazos_eng_projeto_id_fkey
    FOREIGN KEY (eng_projeto_id) REFERENCES engenheiros_projetos(id) ON DELETE CASCADE;

COMMIT;
