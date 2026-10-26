-- =====================================================
-- REVERTER ÁREAS PARA GENÉRICAS
-- =====================================================
-- Remove áreas específicas (H1-CL4) e restaura genéricas
-- =====================================================

-- Remove áreas específicas dos seeds
DELETE FROM areas WHERE codigo IN (
    -- Hidráulico
    'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
    -- Elétrico
    'E1', 'E2', 'E3', 'E4',
    -- Telefonia
    'T1', 'T2', 'T3', 'T4',
    -- Gás
    'G1', 'G2', 'G3', 'G4',
    -- Climatização
    'CL1', 'CL2', 'CL3', 'CL4'
);

-- Insere áreas genéricas
INSERT INTO areas (codigo, descricao, tempo_trabalho_dias) VALUES
('HIDRAULICO', 'Hidráulico', 12),
('ELETRICO', 'Elétrico', 15),
('TELEFONIA', 'Telefonia e Dados', 7),
('GAS', 'Gás', 5),
('CLIMATIZACAO', 'Climatização', 10),
('ESTRUTURAL', 'Estrutural', 20),
('PREVENCAO_INCENDIO', 'Prevenção e Combate a Incêndio', 8),
('SPDA', 'SPDA (Para-raios)', 5),
('AUTOMACAO', 'Automação', 10),
('DRENAGEM', 'Drenagem', 10),
('REDE_AGUA', 'Rede de Água', 12),
('FURACAO_ENCAMISAMENTO', 'Furação e Encamisamento', 5),
('ESGOTO', 'Esgoto', 10),
('CANT_OBRA_DRT', 'Canteiro de Obra DRT', 5),
('DRT', 'DRT', 5),
('CANT_OBRA_ENERGISA', 'Canteiro de Obra Energisa', 5),
('SUBESTACAO', 'Subestação', 15),
('REDE_ESGOTO', 'Rede de Esgoto', 12),
('REDE_DRENAGEM', 'Rede de Drenagem', 10),
('REDE_ELETRICA_SUBTERRANEA', 'Rede Elétrica Subterrânea', 12),
('REDE_ELETRICA_AEREA', 'Rede Elétrica Aérea', 10),
('EXAUSTAO', 'Exaustão', 8),
('SOLAR_FOTOVOLTAICO', 'Solar Fotovoltaico', 12),
('HIDRAULICO_PISCINA', 'Hidráulico Piscina', 8),
('SOLUCAO_SANITARIA', 'Solução Sanitária', 7),
('ADMINISTRATIVO', 'Administrativo', 0),
('ENERGISA', 'Energisa', 0),
('CALCULO_AREAS', 'Cálculo de Áreas', 0),
('ESTACAO_ELEVATORIA_ESGOTO', 'Estação Elevatória de Esgoto', 0)
ON CONFLICT (codigo) DO UPDATE SET
    descricao = EXCLUDED.descricao,
    tempo_trabalho_dias = EXCLUDED.tempo_trabalho_dias;

-- Verificação
SELECT '✅ Áreas genéricas restauradas!' AS resultado;

SELECT 
    codigo,
    LEFT(descricao, 50) AS descricao,
    tempo_trabalho_dias || ' dias' AS tempo
FROM areas
ORDER BY codigo;

-- =====================================================
-- FIM DO SCRIPT
-- =====================================================

