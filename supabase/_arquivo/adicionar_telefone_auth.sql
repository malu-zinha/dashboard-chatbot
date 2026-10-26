-- =====================================================
-- COMPLEMENTO: Adicionar Telefone/WhatsApp para Auth
-- =====================================================
-- Adiciona campo telefone em engenheiros para autenticação
-- Usa telefone em dono_empresa como WhatsApp
-- =====================================================

-- Adicionar coluna telefone em engenheiros
ALTER TABLE engenheiros 
ADD COLUMN IF NOT EXISTS telefone VARCHAR(20) UNIQUE;

-- Adicionar índice para busca rápida por telefone
CREATE INDEX IF NOT EXISTS idx_engenheiros_telefone ON engenheiros(telefone);

-- Adicionar índice para busca rápida por telefone do dono
CREATE INDEX IF NOT EXISTS idx_dono_telefone ON dono_empresa(telefone);

-- Comentários explicativos
COMMENT ON COLUMN engenheiros.telefone IS 'Número de WhatsApp no formato +5511999999999 para autenticação no chatbot';
COMMENT ON COLUMN dono_empresa.telefone IS 'Número de WhatsApp no formato +5511999999999 para autenticação no chatbot';

-- Script executado com sucesso!
-- Agora você pode cadastrar telefones dos engenheiros e usar para autenticação

