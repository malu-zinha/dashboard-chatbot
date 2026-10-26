-- =====================================================
-- CRIAR TABELA: tipos_projeto
-- =====================================================
-- Tipos específicos de projeto que referenciam áreas genéricas
-- Exemplo: H1, H2, H3 → HIDRAULICO
--          E1, E2, E3 → ELETRICO
-- =====================================================

CREATE TABLE IF NOT EXISTS tipos_projeto (
    codigo TEXT PRIMARY KEY,
    area_codigo TEXT NOT NULL REFERENCES areas(codigo) ON DELETE CASCADE,
    descricao TEXT NOT NULL,
    tempo_trabalho_dias INTEGER NOT NULL,
    ordem INTEGER,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tipos_projeto_area ON tipos_projeto(area_codigo);
CREATE INDEX IF NOT EXISTS idx_tipos_projeto_ativo ON tipos_projeto(ativo);

COMMENT ON TABLE tipos_projeto IS 'Tipos específicos de projeto vinculados às áreas genéricas';
COMMENT ON COLUMN tipos_projeto.area_codigo IS 'Referência para a área genérica (HIDRAULICO, ELETRICO, etc.)';

-- =====================================================
-- SEED: HIDRÁULICO (H1-H6)
-- =====================================================

INSERT INTO tipos_projeto (codigo, area_codigo, descricao, tempo_trabalho_dias, ordem) VALUES
('H1', 'HIDRAULICO', 'H - CASA PADRÃO: TÉRREO E PAV. SUPERIOR', 4, 1),
('H2', 'HIDRAULICO', 'H - CASA PADRÃO (MODELO ÉDREI): TÉRREO E PAV. SUPERIOR', 4, 2),
('H3', 'HIDRAULICO', 'H - CASA PADRÃO: TÉRREO E PAV. SUPERIOR: 1° PAV, PAV TIPO, COBERTURA, COBERTA, RESERVATÓRIOS', 13, 3),
('H4', 'HIDRAULICO', 'H - PRÉDIO PADRÃO: SUBSOLO, TÉRREO, 1°PAV, PAV TIPO, COBERTURA, COBERTA, RESERVATÓRIOS', 17, 4),
('H5', 'HIDRAULICO', 'H - PRÉDIO PADRÃO: SUBSOLO, TÉRREO, MEZANINO, 1°PAV, PAV TIPO, COBERTURA, COBERTA, RESERVATÓRIOS', 19, 5),
('H6', 'HIDRAULICO', 'H - PRÉDIO PADRÃO: SUBSOLO 01, SUBSOLO 02, TÉRREO, MEZANINO, 1°PAV, PAV TIPO, COBERTURA, COBERTA, RESERVATÓRIOS', 21, 6)
ON CONFLICT (codigo) DO UPDATE SET
    area_codigo = EXCLUDED.area_codigo,
    descricao = EXCLUDED.descricao,
    tempo_trabalho_dias = EXCLUDED.tempo_trabalho_dias,
    ordem = EXCLUDED.ordem;

-- =====================================================
-- SEED: ELÉTRICO (E1-E4)
-- =====================================================

INSERT INTO tipos_projeto (codigo, area_codigo, descricao, tempo_trabalho_dias, ordem) VALUES
('E1', 'ELETRICO', 'E - CASA PADRÃO (MODELO SETAI): TÉRREO E PAV. SUPERIOR', 4, 1),
('E2', 'ELETRICO', 'E - CASA PADRÃO (MODELO ÉDREI): SUBSOLO E TÉRREO', 15, 2),
('E3', 'ELETRICO', 'E - PRÉDIO (MODELO ATLANTIS NEW): SEMISUBSOLO, TÉRREO, 1°PAV, PAV TIPO, COBERTURA, CORTE ESQUEMÁTICO, ENERGISA', 20, 3),
('E4', 'ELETRICO', 'E - PRÉDIO (MODELO ALLIANCE ESSENCE): SUBSOLO-03, SUBSOLO-02, SUBSOLO-01, TÉRREO, SOBRESSOLO, PAV. LAZER, PAV TIPO A,B, PAV. TIPO C,D, ROOFTOP, CORTE ESQUEMÁTICO, ENERGISA', 25, 4)
ON CONFLICT (codigo) DO UPDATE SET
    area_codigo = EXCLUDED.area_codigo,
    descricao = EXCLUDED.descricao,
    tempo_trabalho_dias = EXCLUDED.tempo_trabalho_dias,
    ordem = EXCLUDED.ordem;

-- =====================================================
-- SEED: TELEFONIA (T1-T4)
-- =====================================================

INSERT INTO tipos_projeto (codigo, area_codigo, descricao, tempo_trabalho_dias, ordem) VALUES
('T1', 'TELEFONIA', 'T - CASA PADRÃO (MODELO SETAI): TÉRREO E PAV. SUPERIOR', 1, 1),
('T2', 'TELEFONIA', 'T - CASA PADRÃO (MODELO ÉDREI): SUBSOLO E TÉRREO', 1, 2),
('T3', 'TELEFONIA', 'T - PRÉDIO (MODELO ATLANTIS NEW): SEMISUBSOLO, TÉRREO, 1°PAV, PAV TIPO, COBERTURA, CORTE ESQUEMÁTICO, ENERGISA', 3, 3),
('T4', 'TELEFONIA', 'T - PRÉDIO (MODELO ALLIANCE ESSENCE): SUBSOLO-03, SUBSOLO-02, SUBSOLO-01, TÉRREO, SOBRESSOLO, PAV. LAZER, PAV TIPO A,B, PAV. TIPO C,D, ROOFTOP, CORTE ESQUEMÁTICO, ENERGISA', 5, 4)
ON CONFLICT (codigo) DO UPDATE SET
    area_codigo = EXCLUDED.area_codigo,
    descricao = EXCLUDED.descricao,
    tempo_trabalho_dias = EXCLUDED.tempo_trabalho_dias,
    ordem = EXCLUDED.ordem;

-- =====================================================
-- SEED: GÁS (G1-G4)
-- =====================================================

INSERT INTO tipos_projeto (codigo, area_codigo, descricao, tempo_trabalho_dias, ordem) VALUES
('G1', 'GAS', 'G - CASA PADRÃO (MODELO SETAI): TÉRREO E PAV. SUPERIOR', 1, 1),
('G2', 'GAS', 'G - CASA PADRÃO (MODELO ÉDREI): SUBSOLO E TÉRREO', 1, 2),
('G3', 'GAS', 'G - PRÉDIO (MODELO ATLANTIS NEW): SEMISUBSOLO, TÉRREO, 1°PAV, PAV TIPO, COBERTURA, CORTE ESQUEMÁTICO, ENERGISA', 2, 3),
('G4', 'GAS', 'G - PRÉDIO (MODELO ALLIANCE ESSENCE): SUBSOLO-03, SUBSOLO-02, SUBSOLO-01, TÉRREO, SOBRESSOLO, PAV. LAZER, PAV TIPO A,B, PAV. TIPO C,D, ROOFTOP, CORTE ESQUEMÁTICO, ENERGISA', 3, 4)
ON CONFLICT (codigo) DO UPDATE SET
    area_codigo = EXCLUDED.area_codigo,
    descricao = EXCLUDED.descricao,
    tempo_trabalho_dias = EXCLUDED.tempo_trabalho_dias,
    ordem = EXCLUDED.ordem;

-- =====================================================
-- SEED: CLIMATIZAÇÃO (CL1-CL4)
-- =====================================================

INSERT INTO tipos_projeto (codigo, area_codigo, descricao, tempo_trabalho_dias, ordem) VALUES
('CL1', 'CLIMATIZACAO', 'CL - CASA PADRÃO (MODELO SETAI): TÉRREO E PAV. SUPERIOR', 1, 1),
('CL2', 'CLIMATIZACAO', 'CL - CASA PADRÃO (MODELO ÉDREI): SUBSOLO E TÉRREO', 1, 2),
('CL3', 'CLIMATIZACAO', 'CL - PRÉDIO (MODELO ATLANTIS NEW): SEMISUBSOLO, TÉRREO, 1°PAV, PAV TIPO, COBERTURA, CORTE ESQUEMÁTICO, ENERGISA', 2, 3),
('CL4', 'CLIMATIZACAO', 'CL - PRÉDIO (MODELO ALLIANCE ESSENCE): SUBSOLO-03, SUBSOLO-02, SUBSOLO-01, TÉRREO, SOBRESSOLO, PAV. LAZER, PAV TIPO A,B, PAV. TIPO C,D, ROOFTOP, CORTE ESQUEMÁTICO, ENERGISA', 3, 4)
ON CONFLICT (codigo) DO UPDATE SET
    area_codigo = EXCLUDED.area_codigo,
    descricao = EXCLUDED.descricao,
    tempo_trabalho_dias = EXCLUDED.tempo_trabalho_dias,
    ordem = EXCLUDED.ordem;

-- =====================================================
-- FUNCTION: Listar tipos de projeto por área
-- =====================================================

CREATE OR REPLACE FUNCTION listar_tipos_projeto_por_area(p_area_codigo TEXT)
RETURNS JSON AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'codigo', codigo,
            'descricao', descricao,
            'tempo_dias', tempo_trabalho_dias
        ) ORDER BY ordem
    ) INTO v_result
    FROM tipos_projeto
    WHERE area_codigo = p_area_codigo
    AND ativo = true;
    
    RETURN COALESCE(v_result, '[]'::json);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION listar_tipos_projeto_por_area IS 'Lista tipos de projeto filtrados por área genérica';

-- =====================================================
-- FUNCTION: Listar todos os tipos de projeto
-- =====================================================

CREATE OR REPLACE FUNCTION listar_tipos_projeto()
RETURNS JSON AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'codigo', tp.codigo,
            'area', a.descricao,
            'descricao', tp.descricao,
            'tempo_dias', tp.tempo_trabalho_dias
        ) ORDER BY a.codigo, tp.ordem
    ) INTO v_result
    FROM tipos_projeto tp
    JOIN areas a ON a.codigo = tp.area_codigo
    WHERE tp.ativo = true;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION listar_tipos_projeto IS 'Lista todos os tipos de projeto com suas áreas';

-- =====================================================
-- VIEW: tipos_projeto com área
-- =====================================================

CREATE OR REPLACE VIEW vw_tipos_projeto AS
SELECT 
    tp.codigo,
    tp.area_codigo,
    a.descricao AS area_descricao,
    tp.descricao AS tipo_descricao,
    tp.tempo_trabalho_dias,
    tp.ordem,
    tp.ativo
FROM tipos_projeto tp
JOIN areas a ON a.codigo = tp.area_codigo
WHERE tp.ativo = true
ORDER BY a.codigo, tp.ordem;

COMMENT ON VIEW vw_tipos_projeto IS 'Tipos de projeto com informações da área genérica';

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================

SELECT '✅ Tabela tipos_projeto criada com sucesso!' AS resultado;

SELECT 
    '📊 Total de tipos por área:' AS info;

SELECT 
    a.codigo AS area,
    a.descricao AS area_nome,
    COUNT(tp.codigo) AS total_tipos,
    MIN(tp.tempo_trabalho_dias) || ' a ' || MAX(tp.tempo_trabalho_dias) || ' dias' AS faixa_tempo
FROM areas a
LEFT JOIN tipos_projeto tp ON tp.area_codigo = a.codigo
WHERE a.ativo = true
GROUP BY a.codigo, a.descricao
ORDER BY a.codigo;

-- Exemplos de uso:
SELECT '🔍 Exemplo: Tipos de projeto da área HIDRAULICO:' AS exemplo;
SELECT listar_tipos_projeto_por_area('HIDRAULICO');

SELECT '🔍 Exemplo: Todos os tipos de projeto:' AS exemplo;
SELECT listar_tipos_projeto();

-- =====================================================
-- FIM DO SCRIPT
-- =====================================================

