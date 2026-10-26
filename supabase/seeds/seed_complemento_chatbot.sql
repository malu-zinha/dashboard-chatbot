-- =====================================================
-- SEED COMPLEMENTO - Dados para menus do chatbot
-- =====================================================
-- Execute APÓS os outros seeds
-- =====================================================

-- =====================================================
-- TABELA: tipos_obra
-- =====================================================

CREATE TABLE IF NOT EXISTS tipos_obra (
    codigo TEXT PRIMARY KEY,
    descricao TEXT NOT NULL,
    ordem INTEGER,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO tipos_obra (codigo, descricao, ordem) VALUES
('CASA', 'Casa', 1),
('PREDIO', 'Prédio', 2),
('COMERCIAL', 'Comercial', 3),
('MISTO', 'Misto', 4)
ON CONFLICT (codigo) DO UPDATE SET 
    descricao = EXCLUDED.descricao,
    ordem = EXCLUDED.ordem;

COMMENT ON TABLE tipos_obra IS 'Tipos de obra disponíveis para cadastro de projetos';

-- =====================================================
-- TABELA: motivos_retrabalho
-- =====================================================

CREATE TABLE IF NOT EXISTS motivos_retrabalho (
    codigo TEXT PRIMARY KEY,
    descricao TEXT NOT NULL,
    ordem INTEGER,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO motivos_retrabalho (codigo, descricao, ordem) VALUES
('ERRO_INTERNO', 'Erro interno', 1),
('FALTA_INFO_CLIENTE', 'Falta de informação do cliente', 2),
('MUDANCA_ESCOPO_CLIENTE', 'Mudança de escopo devido cliente', 3),
('MUDANCA_ESCOPO_TECPRED', 'Mudança de escopo devido TecPred', 4),
('ADEQUACAO_CONCESSIONARIA', 'Adequação à concessionária', 5),
('ATRASO_DOCUMENTACAO', 'Atraso de documentação', 6)
ON CONFLICT (codigo) DO UPDATE SET 
    descricao = EXCLUDED.descricao,
    ordem = EXCLUDED.ordem;

COMMENT ON TABLE motivos_retrabalho IS 'Motivos padrão para retrabalhos';

-- =====================================================
-- FUNCTION: Buscar sugestões de previsão por status
-- =====================================================

CREATE OR REPLACE FUNCTION buscar_sugestoes_previsao(p_status_codigo TEXT)
RETURNS JSON AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'ordem', ordem,
            'descricao', descricao
        ) ORDER BY ordem
    ) INTO v_result
    FROM status_detalhamento
    WHERE status_codigo = p_status_codigo
    AND tipo = 'PREVISAO';
    
    RETURN COALESCE(v_result, '[]'::json);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION buscar_sugestoes_previsao IS 'Busca sugestões de previsão para um status específico';

-- =====================================================
-- FUNCTION: Buscar sugestões de feito por status
-- =====================================================

CREATE OR REPLACE FUNCTION buscar_sugestoes_feito(p_status_codigo TEXT)
RETURNS JSON AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'ordem', ordem,
            'descricao', descricao
        ) ORDER BY ordem
    ) INTO v_result
    FROM status_detalhamento
    WHERE status_codigo = p_status_codigo
    AND tipo = 'FEITO';
    
    RETURN COALESCE(v_result, '[]'::json);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION buscar_sugestoes_feito IS 'Busca sugestões de feito para um status específico';

-- =====================================================
-- FUNCTION: Listar tipos de obra para o menu
-- =====================================================

CREATE OR REPLACE FUNCTION listar_tipos_obra()
RETURNS JSON AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'codigo', codigo,
            'descricao', descricao
        ) ORDER BY ordem
    ) INTO v_result
    FROM tipos_obra
    WHERE ativo = true;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION listar_tipos_obra IS 'Lista tipos de obra para menu do chatbot';

-- =====================================================
-- FUNCTION: Listar motivos de retrabalho para o menu
-- =====================================================

CREATE OR REPLACE FUNCTION listar_motivos_retrabalho()
RETURNS JSON AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'codigo', codigo,
            'descricao', descricao
        ) ORDER BY ordem
    ) INTO v_result
    FROM motivos_retrabalho
    WHERE ativo = true;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION listar_motivos_retrabalho IS 'Lista motivos de retrabalho para menu do chatbot';

-- =====================================================
-- FUNCTION: Gerar próximo código de projeto
-- =====================================================

CREATE OR REPLACE FUNCTION gerar_proximo_codigo_projeto()
RETURNS TEXT AS $$
DECLARE
    v_ultimo_numero INTEGER;
    v_proximo_codigo TEXT;
BEGIN
    -- Busca o maior número de projeto existente
    SELECT COALESCE(
        MAX(
            NULLIF(
                regexp_replace(codigo_projeto, '[^0-9]', '', 'g'),
                ''
            )::INTEGER
        ),
        0
    ) INTO v_ultimo_numero
    FROM projetos;
    
    -- Gera próximo código
    v_proximo_codigo := 'PRJ-' || LPAD((v_ultimo_numero + 1)::TEXT, 3, '0');
    
    RETURN v_proximo_codigo;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION gerar_proximo_codigo_projeto IS 'Gera próximo código sequencial de projeto (PRJ-001, PRJ-002...)';

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================

SELECT '✅ Tipos de obra cadastrados:' AS info, COUNT(*) AS total FROM tipos_obra;
SELECT '✅ Motivos de retrabalho cadastrados:' AS info, COUNT(*) AS total FROM motivos_retrabalho;

-- Teste de funções
SELECT '✅ Próximo código de projeto:' AS info, gerar_proximo_codigo_projeto() AS codigo;
SELECT '✅ Tipos de obra disponíveis:' AS info, listar_tipos_obra() AS json_result;
SELECT '✅ Motivos de retrabalho disponíveis:' AS info, listar_motivos_retrabalho() AS json_result;

-- Teste de sugestões por status
SELECT '✅ Sugestões de previsão (EM_EXECUCAO):' AS info;
SELECT buscar_sugestoes_previsao('EM_EXECUCAO');

SELECT '✅ Sugestões de feito (EM_EXECUCAO):' AS info;
SELECT buscar_sugestoes_feito('EM_EXECUCAO');

-- =====================================================
-- FIM DO ARQUIVO
-- =====================================================

