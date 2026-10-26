// =====================================================
// INICIALIZAÇÃO: Carregar variáveis de ambiente
// =====================================================
// Este arquivo DEVE ser importado PRIMEIRO em todos os testes
// Garante que o .env seja carregado antes de qualquer outro código
// =====================================================

import dotenv from 'dotenv';

// Carregar .env imediatamente
dotenv.config();

console.log('✅ [INIT] Variáveis de ambiente carregadas');
console.log(`✅ [INIT] SUPABASE_URL: ${process.env.SUPABASE_URL ? 'Configurada' : 'NÃO configurada'}`);
console.log(`✅ [INIT] SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Configurada' : 'NÃO configurada'}`);

// Validar variáveis críticas
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('\n❌ ERRO: Variáveis de ambiente não configuradas!');
  console.error('   Faltam no .env:');
  if (!process.env.SUPABASE_URL) console.error('   - SUPABASE_URL');
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  console.error('\n');
  process.exit(1);
}

