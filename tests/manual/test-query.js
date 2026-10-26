import dotenv from 'dotenv';
import readline from 'readline';
import { getGoogleSheetsService } from '../../integrations/sheets/googleSheetsService.ts';
import { QueryService } from '../../chatbot/handlers/queryService.ts';

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
console.log('║  🧪 TESTE DE CONSULTA - MODO TERMINAL     ║');
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
      console.log('📌 Primeiros registros da planilha:');
      console.log('─'.repeat(60));
      data.slice(0, 3).forEach((row, idx) => {
        console.log(`${idx + 1}. ${JSON.stringify(row)}`);
      });
      console.log('─'.repeat(60));
    }
    
    return true;
  } catch (error) {
    console.error('❌ Erro ao carregar planilha:', error.message);
    return false;
  }
}

// Processar pergunta
async function processQuestion(question) {
  try {
    if (cachedSheetData.length === 0) {
      return '❌ Nenhum dado disponível na planilha.';
    }

    console.log('\n🤖 Processando sua pergunta...');
    
    // Usar query otimizada para planilhas grandes
    const result = cachedSheetData.length > 100
      ? await QueryService.querySheetOptimized(question, cachedSheetData, cachedHeaders)
      : await QueryService.querySheet(question, cachedSheetData, cachedHeaders);

    return result.answer;
  } catch (error) {
    console.error('Erro ao processar:', error.message);
    return '❌ Erro ao processar sua pergunta. Tente novamente.';
  }
}

// Loop de perguntas
function askQuestion() {
  rl.question('\n💬 Digite sua pergunta (ou "sair" para encerrar): ', async (input) => {
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
    
    if (question.toLowerCase() === 'help' || question.toLowerCase() === 'ajuda') {
      console.log('\n📖 Comandos disponíveis:');
      console.log('  • Digite qualquer pergunta para consultar a planilha');
      console.log('  • "reload" ou "atualizar" - Recarrega os dados da planilha');
      console.log('  • "sair" ou "exit" - Encerra o teste\n');
      askQuestion();
      return;
    }
    
    // Processar pergunta
    const answer = await processQuestion(question);
    
    console.log('\n╔════════════════════════════════════════════╗');
    console.log('║  📊 RESPOSTA:                             ║');
    console.log('╚════════════════════════════════════════════╝');
    console.log('\n' + answer + '\n');
    console.log('─'.repeat(60));
    
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
  console.log('║  ✅ PRONTO PARA TESTAR!                   ║');
  console.log('╚════════════════════════════════════════════╝');
  console.log('\n📝 Exemplos de perguntas:');
  console.log('  • "Quantos registros temos?"');
  console.log('  • "Mostre os dados da primeira linha"');
  console.log('  • "Qual o total de [alguma coluna]?"');
  console.log('\n💡 Digite "ajuda" para ver comandos disponíveis');
  
  askQuestion();
})();

