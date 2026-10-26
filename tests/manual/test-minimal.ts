#!/usr/bin/env ts-node
// =====================================================
// TESTE MINIMAL: Verificar se o problema é nos imports
// =====================================================

console.log('✅ Script iniciou!');

console.log('🔍 Importando dotenv...');
import dotenv from 'dotenv';
console.log('✅ dotenv importado!');

console.log('🔍 Executando dotenv.config()...');
dotenv.config();
console.log('✅ dotenv.config() executado!');

console.log('\n📋 Verificando variáveis de ambiente:');
console.log('   SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ Configurada' : '❌ NÃO configurada');
console.log('   SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Configurada' : '❌ NÃO configurada');
console.log('   GOOGLE_SHEETS_ENGINEER_ID:', process.env.GOOGLE_SHEETS_ENGINEER_ID ? '✅ Configurada' : '⚠️  NÃO configurada');

console.log('\n✅ Teste minimal concluído!');
console.log('   Problema NÃO está no .env ou nas importações básicas.\n');

process.exit(0);

