// =====================================================
// DEBUG: Forçar dotenv a mostrar o que está lendo
// =====================================================

const fs = require('fs');
const path = require('path');

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║     🔍 DEBUG DO DOTENV                                    ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

// 1. Verificar diretório atual
console.log('📂 Diretório atual:', process.cwd());
console.log('');

// 2. Verificar se .env existe
const envPath = path.join(process.cwd(), '.env');
console.log('📄 Caminho do .env:', envPath);
console.log('✅ Existe?', fs.existsSync(envPath));
console.log('');

// 3. Tentar ler manualmente
try {
  const content = fs.readFileSync(envPath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim() && !l.trim().startsWith('#'));
  console.log(`📝 Conteúdo manual: ${lines.length} linhas válidas`);
  lines.slice(0, 3).forEach(line => {
    const parts = line.split('=');
    console.log(`   ${parts[0]}=***`);
  });
  console.log('');
} catch (error) {
  console.log('❌ Erro ao ler manualmente:', error.message);
  console.log('');
}

// 4. Tentar com dotenv
console.log('🔧 Tentando dotenv.config()...');
const result = require('dotenv').config();

if (result.error) {
  console.log('❌ Erro do dotenv:', result.error.message);
} else {
  console.log('✅ Dotenv carregou sem erros');
  console.log('📊 Variáveis parseadas:', Object.keys(result.parsed || {}).length);
  
  if (result.parsed) {
    console.log('\nVariáveis encontradas pelo dotenv:');
    Object.keys(result.parsed).slice(0, 5).forEach(key => {
      console.log(`   ${key}=***`);
    });
  }
}
console.log('');

// 5. Verificar process.env
console.log('🔍 Verificando process.env:');
const testVars = ['SUPABASE_URL', 'OPENAI_API_KEY', 'GOOGLE_SHEETS_ENGINEER_ID'];
testVars.forEach(key => {
  console.log(`   ${key}: ${process.env[key] ? '✅ encontrada' : '❌ não encontrada'}`);
});
console.log('');

