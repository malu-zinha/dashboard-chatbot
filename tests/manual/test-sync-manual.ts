#!/usr/bin/env ts-node
// =====================================================
// TESTE: Sincronização Manual Supabase → Google Sheets
// =====================================================
// Execute: npm run test:sync
// =====================================================

import { executarSincronizacao } from '../../integrations/cron/syncDatabaseToSheets.ts';
import dotenv from 'dotenv';

dotenv.config();

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║     🧪 TESTE DE SINCRONIZAÇÃO MANUAL                      ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

// Verificar variáveis necessárias
const requiredVars = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'GOOGLE_APPLICATION_CREDENTIALS'
];

const missing = requiredVars.filter(v => !process.env[v]);

if (missing.length > 0) {
  console.error('❌ Variáveis de ambiente faltando:');
  missing.forEach(v => console.error(`   - ${v}`));
  console.log('\n💡 Configure no arquivo .env\n');
  process.exit(1);
}

// Verificar se há planilhas configuradas (compatível com variáveis antigas e novas)
const hasSheets = 
  process.env.GOOGLE_SHEETS_ENG1_ID ||
  process.env.GOOGLE_SHEETS_ENG2_ID ||
  process.env.GOOGLE_SHEETS_CEO_ID ||
  process.env.GOOGLE_SHEETS_ENGINEER_ID; // Variável antiga

if (!hasSheets) {
  console.log('⚠️  Nenhuma planilha configurada para sincronização');
  console.log('\n💡 Configure no .env (opção 1 - usar planilha existente):');
  console.log('   GOOGLE_SHEETS_ENGINEER_ID=...');
  console.log('   GOOGLE_SHEETS_ENGINEER_SHEET=Engenheiro(a)');
  console.log('   GOOGLE_SHEETS_ENGINEER_RANGE=A2:AE1000\n');
  console.log('💡 Ou configure nova planilha (opção 2):');
  console.log('   GOOGLE_SHEETS_ENG1_ID=...');
  console.log('   GOOGLE_SHEETS_ENG1_NAME=Engenheiro(a)');
  console.log('   GOOGLE_SHEETS_ENG1_RANGE=A2:AE1000');
  console.log('   GOOGLE_SHEETS_ENG1_WHATSAPP=+5511999999999\n');
  console.log('   (Opcional: ENG2, ENG3, CEO)\n');
  process.exit(1);
}

// Executar sincronização
executarSincronizacao()
  .then(() => {
    console.log('\n✅ Teste de sincronização concluído!');
    console.log('\n💡 Para ativar sincronização automática:');
    console.log('   1. Adicione ao src/index.ts:');
    console.log('      import { iniciarSincronizacaoAutomatica } from ...');
    console.log('      iniciarSincronizacaoAutomatica();');
    console.log('   2. Ou rode: npm start\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro no teste:', error.message);
    process.exit(1);
  });

