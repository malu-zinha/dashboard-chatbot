import dotenv from 'dotenv';
import readline from 'readline';
import { getGoogleSheetsService } from '../../integrations/sheets/googleSheetsService.ts';

// Carregar variáveis de ambiente
dotenv.config();

// Configuração da planilha
const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID || '';
const SHEET_RANGE = process.env.GOOGLE_SHEETS_RANGE || 'A1:Z1000';

// Cache dos dados
let cachedSheetData = [];
let cachedHeaders = [];

// Interface readline para input do terminal
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('╔════════════════════════════════════════════╗');
console.log('║  🧪 TESTE SIMPLES - SEM IA (Sem OpenAI)  ║');
console.log('╚════════════════════════════════════════════╝\n');

// Validar configurações
if (!SPREADSHEET_ID) {
  console.error('❌ GOOGLE_SHEETS_ID não configurado no .env');
  process.exit(1);
}

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('❌ GOOGLE_APPLICATION_CREDENTIALS não configurado no .env');
  process.exit(1);
}

// Carregar dados da planilha
async function loadSheet() {
  try {
    console.log('📊 Carregando dados da planilha...\n');
    
    const sheetsService = getGoogleSheetsService();
    const data = await sheetsService.readSheetAsObjects(SPREADSHEET_ID, SHEET_RANGE);
    const { headers } = await sheetsService.readSheet(SPREADSHEET_ID, SHEET_RANGE);
    
    cachedSheetData = data;
    cachedHeaders = headers;
    
    console.log(`✅ Planilha carregada com sucesso!`);
    console.log(`📋 Colunas: ${headers.join(', ')}`);
    console.log(`📊 Total de registros: ${data.length}\n`);
    
    // Mostrar amostra dos dados
    if (data.length > 0) {
      console.log('📌 Amostra dos dados (primeiros 5 registros):');
      console.log('─'.repeat(80));
      data.slice(0, 5).forEach((row, idx) => {
        console.log(`${idx + 1}. ${JSON.stringify(row, null, 2)}`);
      });
      console.log('─'.repeat(80));
    }
    
    return true;
  } catch (error) {
    console.error('❌ Erro ao carregar planilha:', error.message);
    return false;
  }
}

// Busca simples (SEM IA)
function simpleSearch(keyword) {
  const keywords = keyword.toLowerCase().split(/\s+/);
  
  const matches = cachedSheetData.filter(row => 
    keywords.some(kw => 
      Object.values(row).some(value => 
        String(value).toLowerCase().includes(kw)
      )
    )
  );

  if (matches.length === 0) {
    return '❌ Nenhum resultado encontrado.';
  }

  let answer = `✅ Encontrei *${matches.length}* resultado(s):\n\n`;
  matches.slice(0, 10).forEach((match, idx) => {
    answer += `${idx + 1}. `;
    answer += Object.entries(match)
      .filter(([_, value]) => value)
      .map(([key, value]) => `${key}: ${value}`)
      .join(' | ');
    answer += '\n';
  });
  
  if (matches.length > 10) {
    answer += `\n... e mais ${matches.length - 10} resultado(s)`;
  }

  return answer;
}

// Loop de perguntas
function askQuestion() {
  rl.question('\n🔍 Digite uma palavra-chave para buscar (ou "sair"): ', async (input) => {
    const question = input.trim();
    
    if (!question) {
      askQuestion();
      return;
    }
    
    if (question.toLowerCase() === 'sair' || question.toLowerCase() === 'exit') {
      console.log('\n👋 Encerrando teste. Até logo!\n');
      rl.close();
      process.exit(0);
      return;
    }
    
    if (question.toLowerCase() === 'reload' || question.toLowerCase() === 'atualizar') {
      await loadSheet();
      askQuestion();
      return;
    }
    
    if (question.toLowerCase() === 'all' || question.toLowerCase() === 'todos') {
      console.log('\n📊 TODOS OS DADOS:');
      console.log('─'.repeat(80));
      cachedSheetData.forEach((row, idx) => {
        console.log(`${idx + 1}. ${JSON.stringify(row)}`);
      });
      console.log('─'.repeat(80));
      askQuestion();
      return;
    }
    
    if (question.toLowerCase() === 'count' || question.toLowerCase() === 'contar') {
      console.log(`\n📊 Total de registros: ${cachedSheetData.length}`);
      console.log(`📋 Colunas: ${cachedHeaders.join(', ')}`);
      askQuestion();
      return;
    }
    
    if (question.toLowerCase() === 'help' || question.toLowerCase() === 'ajuda') {
      console.log('\n📖 Comandos disponíveis:');
      console.log('  • Digite qualquer palavra-chave para buscar');
      console.log('  • "todos" ou "all" - Mostra todos os registros');
      console.log('  • "count" ou "contar" - Mostra total de registros');
      console.log('  • "reload" ou "atualizar" - Recarrega a planilha');
      console.log('  • "sair" ou "exit" - Encerra o teste\n');
      askQuestion();
      return;
    }
    
    // Buscar
    const answer = simpleSearch(question);
    
    console.log('\n╔════════════════════════════════════════════╗');
    console.log('║  📊 RESULTADO DA BUSCA:                   ║');
    console.log('╚════════════════════════════════════════════╝');
    console.log('\n' + answer);
    console.log('─'.repeat(80));
    
    askQuestion();
  });
}

// Iniciar teste
(async () => {
  const loaded = await loadSheet();
  
  if (!loaded) {
    console.log('\n❌ Não foi possível carregar a planilha. Verifique as configurações.\n');
    process.exit(1);
  }
  
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║  ✅ PRONTO PARA TESTAR! (Busca Simples)   ║');
  console.log('╚════════════════════════════════════════════╝');
  console.log('\n💡 Este teste NÃO usa IA da OpenAI');
  console.log('💡 Faz busca simples por palavra-chave');
  console.log('\n📝 Digite "ajuda" para ver comandos disponíveis');
  
  askQuestion();
})();

