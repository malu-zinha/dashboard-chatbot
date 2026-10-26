// =====================================================
// TESTE SIMPLES: Ler .env (sem ESM)
// =====================================================

require('dotenv').config();

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║     🔍 TESTE SIMPLES DE LEITURA DO .env                  ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

const vars = {
  'SUPABASE_URL': process.env.SUPABASE_URL,
  'SUPABASE_SERVICE_ROLE_KEY': process.env.SUPABASE_SERVICE_ROLE_KEY,
  'SUPABASE_ANON_KEY': process.env.SUPABASE_ANON_KEY,
  'GOOGLE_APPLICATION_CREDENTIALS': process.env.GOOGLE_APPLICATION_CREDENTIALS,
  'OPENAI_API_KEY': process.env.OPENAI_API_KEY,
  'GOOGLE_SHEETS_ENGINEER_ID': process.env.GOOGLE_SHEETS_ENGINEER_ID,
  'GOOGLE_SHEETS_ENGINEER_SHEET': process.env.GOOGLE_SHEETS_ENGINEER_SHEET,
  'GOOGLE_SHEETS_ENGINEER_RANGE': process.env.GOOGLE_SHEETS_ENGINEER_RANGE,
  'GOOGLE_SHEETS_ENG1_WHATSAPP': process.env.GOOGLE_SHEETS_ENG1_WHATSAPP,
};

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

let found = 0;
let missing = 0;

for (const [key, value] of Object.entries(vars)) {
  if (value) {
    const display = value.length > 30 ? value.substring(0, 30) + '...' : value;
    console.log(`✅ ${key}`);
    console.log(`   ${display}\n`);
    found++;
  } else {
    console.log(`❌ ${key} - NÃO ENCONTRADA\n`);
    missing++;
  }
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log(`📊 RESUMO: ${found} encontradas, ${missing} faltando\n`);

if (found > 0) {
  console.log('✅ O .env está sendo lido corretamente!\n');
} else {
  console.log('❌ Nenhuma variável foi lida do .env!\n');
  console.log('💡 Possíveis causas:');
  console.log('   1. Arquivo .env não está na raiz do projeto');
  console.log('   2. Arquivo tem encoding incorreto');
  console.log('   3. Problema com dotenv\n');
}

