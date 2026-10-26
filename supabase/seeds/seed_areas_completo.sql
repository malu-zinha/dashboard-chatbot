-- =====================================================
-- SEED COMPLETO - ÁREAS DE TRABALHO (TIPOS DE PROJETO)
-- Baseado na tabela "TIPO DE PROJETO" fornecida
-- Usa ON CONFLICT para atualizar sem apagar dados existentes
-- =====================================================

-- =====================================================
-- HIDRÁULICO (H1-H6)
-- =====================================================

INSERT INTO areas (codigo, descricao, tempo_trabalho_dias) VALUES
('H1', 'H - CASA PADRÃO: TÉRREO E PAV. SUPERIOR', 4) -- 4 a 6 DIAS ÚTEIS (média: 4)
ON CONFLICT (codigo) DO UPDATE SET 
    descricao = EXCLUDED.descricao,
    tempo_trabalho_dias = EXCLUDED.tempo_trabalho_dias;

INSERT INTO areas (codigo, descricao, tempo_trabalho_dias) VALUES
('H2', 'H - CASA PADRÃO (MODELO ÉDREI): TÉRREO E PAV. SUPERIOR', 4) -- 4 a 9 DIAS ÚTEIS (média: 4)
ON CONFLICT (codigo) DO UPDATE SET 
    descricao = EXCLUDED.descricao,
    tempo_trabalho_dias = EXCLUDED.tempo_trabalho_dias;

INSERT INTO areas (codigo, descricao, tempo_trabalho_dias) VALUES
('H3', 'H - CASA PADRÃO: TÉRREO E PAV. SUPERIOR: 1° PAV, PAV TIPO, COBERTURA, COBERTA, RESERVATÓRIOS', 13) -- 13 a 17 DIAS ÚTEIS (média: 13)
ON CONFLICT (codigo) DO UPDATE SET 
    descricao = EXCLUDED.descricao,
    tempo_trabalho_dias = EXCLUDED.tempo_trabalho_dias;

INSERT INTO areas (codigo, descricao, tempo_trabalho_dias) VALUES
('H4', 'H - PRÉDIO PADRÃO: SUBSOLO, TÉRREO, 1°PAV, PAV TIPO, COBERTURA, COBERTA, RESERVATÓRIOS', 17) -- 17 a 20 DIAS ÚTEIS (média: 17)
ON CONFLICT (codigo) DO UPDATE SET 
    descricao = EXCLUDED.descricao,
    tempo_trabalho_dias = EXCLUDED.tempo_trabalho_dias;

INSERT INTO areas (codigo, descricao, tempo_trabalho_dias) VALUES
('H5', 'H - PRÉDIO PADRÃO: SUBSOLO, TÉRREO, MEZANINO, 1°PAV, PAV TIPO, COBERTURA, COBERTA, RESERVATÓRIOS', 19) -- 19 a 21 DIAS ÚTEIS (média: 19)
ON CONFLICT (codigo) DO UPDATE SET 
    descricao = EXCLUDED.descricao,
    tempo_trabalho_dias = EXCLUDED.tempo_trabalho_dias;

INSERT INTO areas (codigo, descricao, tempo_trabalho_dias) VALUES
('H6', 'H - PRÉDIO PADRÃO: SUBSOLO 01, SUBSOLO 02, TÉRREO, MEZANINO, 1°PAV, PAV TIPO, COBERTURA, COBERTA, RESERVATÓRIOS', 21) -- 21 a 22 DIAS ÚTEIS (média: 21)
ON CONFLICT (codigo) DO UPDATE SET 
    descricao = EXCLUDED.descricao,
    tempo_trabalho_dias = EXCLUDED.tempo_trabalho_dias;

-- =====================================================
-- ELÉTRICO (E1-E4)
-- =====================================================

INSERT INTO areas (codigo, descricao, tempo_trabalho_dias) VALUES
('E1', 'E - CASA PADRÃO (MODELO SETAI): TÉRREO E PAV. SUPERIOR', 4) -- 4 a 5 DIAS ÚTEIS (média: 4)
ON CONFLICT (codigo) DO UPDATE SET 
    descricao = EXCLUDED.descricao,
    tempo_trabalho_dias = EXCLUDED.tempo_trabalho_dias;

INSERT INTO areas (codigo, descricao, tempo_trabalho_dias) VALUES
('E2', 'E - CASA PADRÃO (MODELO ÉDREI): SUBSOLO E TÉRREO', 15) -- 15 a 18 DIAS ÚTEIS (média: 15)
ON CONFLICT (codigo) DO UPDATE SET 
    descricao = EXCLUDED.descricao,
    tempo_trabalho_dias = EXCLUDED.tempo_trabalho_dias;

INSERT INTO areas (codigo, descricao, tempo_trabalho_dias) VALUES
('E3', 'E - PRÉDIO (MODELO ATLANTIS NEW): SEMISUBSOLO, TÉRREO, 1°PAV, PAV TIPO, COBERTURA, CORTE ESQUEMÁTICO, ENERGISA', 20) -- 20 a 22 DIAS ÚTEIS (média: 20)
ON CONFLICT (codigo) DO UPDATE SET 
    descricao = EXCLUDED.descricao,
    tempo_trabalho_dias = EXCLUDED.tempo_trabalho_dias;

INSERT INTO areas (codigo, descricao, tempo_trabalho_dias) VALUES
('E4', 'E - PRÉDIO (MODELO ALLIANCE ESSENCE): SUBSOLO-03, SUBSOLO-02, SUBSOLO-01, TÉRREO, SOBRESSOLO, PAV. LAZER, PAV TIPO A,B, PAV. TIPO C,D, ROOFTOP, CORTE ESQUEMÁTICO, ENERGISA', 25) -- 25 a 27 DIAS ÚTEIS (média: 25)
ON CONFLICT (codigo) DO UPDATE SET 
    descricao = EXCLUDED.descricao,
    tempo_trabalho_dias = EXCLUDED.tempo_trabalho_dias;

-- =====================================================
-- TELEFONIA (T1-T4)
-- =====================================================

INSERT INTO areas (codigo, descricao, tempo_trabalho_dias) VALUES
('T1', 'T - CASA PADRÃO (MODELO SETAI): TÉRREO E PAV. SUPERIOR', 1) -- 1 DIA ÚTIL
ON CONFLICT (codigo) DO UPDATE SET 
    descricao = EXCLUDED.descricao,
    tempo_trabalho_dias = EXCLUDED.tempo_trabalho_dias;

INSERT INTO areas (codigo, descricao, tempo_trabalho_dias) VALUES
('T2', 'T - CASA PADRÃO (MODELO ÉDREI): SUBSOLO E TÉRREO', 1) -- 1 DIA ÚTIL
ON CONFLICT (codigo) DO UPDATE SET 
    descricao = EXCLUDED.descricao,
    tempo_trabalho_dias = EXCLUDED.tempo_trabalho_dias;

INSERT INTO areas (codigo, descricao, tempo_trabalho_dias) VALUES
('T3', 'T - PRÉDIO (MODELO ATLANTIS NEW): SEMISUBSOLO, TÉRREO, 1°PAV, PAV TIPO, COBERTURA, CORTE ESQUEMÁTICO, ENERGISA', 3) -- 3 DIAS ÚTEIS
ON CONFLICT (codigo) DO UPDATE SET 
    descricao = EXCLUDED.descricao,
    tempo_trabalho_dias = EXCLUDED.tempo_trabalho_dias;

INSERT INTO areas (codigo, descricao, tempo_trabalho_dias) VALUES
('T4', 'T - PRÉDIO (MODELO ALLIANCE ESSENCE): SUBSOLO-03, SUBSOLO-02, SUBSOLO-01, TÉRREO, SOBRESSOLO, PAV. LAZER, PAV TIPO A,B, PAV. TIPO C,D, ROOFTOP, CORTE ESQUEMÁTICO, ENERGISA', 5) -- 5 DIAS ÚTEIS
ON CONFLICT (codigo) DO UPDATE SET 
    descricao = EXCLUDED.descricao,
    tempo_trabalho_dias = EXCLUDED.tempo_trabalho_dias;

-- =====================================================
-- GÁS (G1-G4)
-- =====================================================

INSERT INTO areas (codigo, descricao, tempo_trabalho_dias) VALUES
('G1', 'G - CASA PADRÃO (MODELO SETAI): TÉRREO E PAV. SUPERIOR', 1) -- 1 DIA ÚTIL
ON CONFLICT (codigo) DO UPDATE SET 
    descricao = EXCLUDED.descricao,
    tempo_trabalho_dias = EXCLUDED.tempo_trabalho_dias;

INSERT INTO areas (codigo, descricao, tempo_trabalho_dias) VALUES
('G2', 'G - CASA PADRÃO (MODELO ÉDREI): SUBSOLO E TÉRREO', 1) -- 1 DIA ÚTIL
ON CONFLICT (codigo) DO UPDATE SET 
    descricao = EXCLUDED.descricao,
    tempo_trabalho_dias = EXCLUDED.tempo_trabalho_dias;

INSERT INTO areas (codigo, descricao, tempo_trabalho_dias) VALUES
('G3', 'G - PRÉDIO (MODELO ATLANTIS NEW): SEMISUBSOLO, TÉRREO, 1°PAV, PAV TIPO, COBERTURA, CORTE ESQUEMÁTICO, ENERGISA', 2) -- 2 DIAS ÚTEIS
ON CONFLICT (codigo) DO UPDATE SET 
    descricao = EXCLUDED.descricao,
    tempo_trabalho_dias = EXCLUDED.tempo_trabalho_dias;

INSERT INTO areas (codigo, descricao, tempo_trabalho_dias) VALUES
('G4', 'G - PRÉDIO (MODELO ALLIANCE ESSENCE): SUBSOLO-03, SUBSOLO-02, SUBSOLO-01, TÉRREO, SOBRESSOLO, PAV. LAZER, PAV TIPO A,B, PAV. TIPO C,D, ROOFTOP, CORTE ESQUEMÁTICO, ENERGISA', 3) -- 3 DIAS ÚTEIS
ON CONFLICT (codigo) DO UPDATE SET 
    descricao = EXCLUDED.descricao,
    tempo_trabalho_dias = EXCLUDED.tempo_trabalho_dias;

-- =====================================================
-- CLIMATIZAÇÃO (CL1-CL4)
-- =====================================================

INSERT INTO areas (codigo, descricao, tempo_trabalho_dias) VALUES
('CL1', 'CL - CASA PADRÃO (MODELO SETAI): TÉRREO E PAV. SUPERIOR', 1) -- 1 DIA ÚTIL
ON CONFLICT (codigo) DO UPDATE SET 
    descricao = EXCLUDED.descricao,
    tempo_trabalho_dias = EXCLUDED.tempo_trabalho_dias;

INSERT INTO areas (codigo, descricao, tempo_trabalho_dias) VALUES
('CL2', 'CL - CASA PADRÃO (MODELO ÉDREI): SUBSOLO E TÉRREO', 1) -- 1 DIA ÚTIL
ON CONFLICT (codigo) DO UPDATE SET 
    descricao = EXCLUDED.descricao,
    tempo_trabalho_dias = EXCLUDED.tempo_trabalho_dias;

INSERT INTO areas (codigo, descricao, tempo_trabalho_dias) VALUES
('CL3', 'CL - PRÉDIO (MODELO ATLANTIS NEW): SEMISUBSOLO, TÉRREO, 1°PAV, PAV TIPO, COBERTURA, CORTE ESQUEMÁTICO, ENERGISA', 2) -- 2 DIAS ÚTEIS
ON CONFLICT (codigo) DO UPDATE SET 
    descricao = EXCLUDED.descricao,
    tempo_trabalho_dias = EXCLUDED.tempo_trabalho_dias;

INSERT INTO areas (codigo, descricao, tempo_trabalho_dias) VALUES
('CL4', 'CL - PRÉDIO (MODELO ALLIANCE ESSENCE): SUBSOLO-03, SUBSOLO-02, SUBSOLO-01, TÉRREO, SOBRESSOLO, PAV. LAZER, PAV TIPO A,B, PAV. TIPO C,D, ROOFTOP, CORTE ESQUEMÁTICO, ENERGISA', 3) -- 3 DIAS ÚTEIS
ON CONFLICT (codigo) DO UPDATE SET 
    descricao = EXCLUDED.descricao,
    tempo_trabalho_dias = EXCLUDED.tempo_trabalho_dias;

-- =====================================================
-- DISCIPLINAS AUXILIARES
-- =====================================================

INSERT INTO areas (codigo, descricao, tempo_trabalho_dias, ativo) VALUES
('COMPATIBILIZACAO', 'Compatibilização', 5, true),
('LIMP_ARQ', 'Limpeza de Arquitetura', 0, true),
('LIMP_EST', 'Limpeza de Estrutura', 0, true),
('COMPLEMENTO', 'Complemento', 0, true),
('ALTERACAO_ENERGISA', 'Alteração Energisa', 0, true),
('ADMINISTRATIVO', 'Administrativo', 0, true),
('ENERGISA', 'Energisa', 0, true),
('CALCULO_AREAS', 'Cálculo de Áreas', 0, true),
('ESTACAO_ELEVATORIA_ESGOTO', 'Estação Elevatória de Esgoto', 0, true)
ON CONFLICT (codigo) DO UPDATE SET
    descricao = EXCLUDED.descricao,
    tempo_trabalho_dias = EXCLUDED.tempo_trabalho_dias,
    ativo = EXCLUDED.ativo;

-- =====================================================
-- RESUMO DE ÁREAS CADASTRADAS
-- =====================================================

SELECT 
    codigo,
    LEFT(descricao, 60) || '...' AS descricao_resumo,
    tempo_trabalho_dias || ' dias' AS tempo
FROM areas
ORDER BY codigo;

-- =====================================================
-- VERIFICAÇÃO: Total de áreas por categoria
-- =====================================================

SELECT 
    SUBSTRING(codigo FROM '^[A-Z]+') AS categoria,
    COUNT(*) AS total_areas,
    MIN(tempo_trabalho_dias) AS min_dias,
    MAX(tempo_trabalho_dias) AS max_dias,
    ROUND(AVG(tempo_trabalho_dias), 1) AS media_dias
FROM areas
GROUP BY SUBSTRING(codigo FROM '^[A-Z]+')
ORDER BY categoria;

/*
RESULTADO ESPERADO:
- H (Hidráulico): 6 áreas (4 a 21 dias)
- E (Elétrico): 4 áreas (4 a 25 dias)
- T (Telefonia): 4 áreas (1 a 5 dias)
- G (Gás): 4 áreas (1 a 3 dias)
- CL (Climatização): 4 áreas (1 a 3 dias)
- LIMP (Limpeza): 2 áreas (0 dias)
- COMPLEMENTO: 1 área (0 dias)

TOTAL: 25 áreas cadastradas
*/




