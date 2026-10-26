import dotenv from 'dotenv';
import readline from 'readline';
import { getGoogleSheetsService } from '../../integrations/sheets/googleSheetsService.ts';
import { CommandService } from '../../chatbot/handlers/commandService.ts';
import { SheetSyncService } from '../../integrations/sheets/sheetSyncService.ts';

// Carregar variáveis de ambiente
dotenv.config();

// Configuração
const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID || '';
const ENGINEER_SHEET = process.env.GOOGLE_SHEETS_ENGINEER_SHEET || 'Engenheiro';
const EVANDRO_SHEET = process.env.GOOGLE_SHEETS_EVANDRO_SHEET || 'Evandro';
const SHEET_RANGE = process.env.GOOGLE_SHEETS_RANGE || 'A1:Z1000';

// Cache
let cachedData = [];
let cachedHeaders = [];

// Interface readline
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('╔════════════════════════════════════════════════════╗');
console.log('║  🧪 TESTE DE ATUALIZAÇÃO E SINCRONIZAÇÃO         ║');
console.log('╚════════════════════════════════════════════════════╝\n');

// Validações
if (!SPREADSHEET_ID) {
  console.error('❌ GOOGLE_SHEETS_ID não configurado no .env');
  process.exit(1);
}

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('❌ GOOGLE_APPLICATION_CREDENTIALS não configurado no .env');
  process.exit(1);
}

if (!process.env.OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY não configurado no .env');
  process.exit(1);
}

// Carregar dados
async function loadData() {
  try {
    console.log('📊 Carregando dados da planilha...\n');
    
    const sheetsService = getGoogleSheetsService();
    const fullRange = `${ENGINEER_SHEET}!${SHEET_RANGE}`;
    
    const data = await sheetsService.readSheetAsObjects(SPREADSHEET_ID, fullRange);
    const { headers } = await sheetsService.readSheet(SPREADSHEET_ID, fullRange);
    
    cachedData = data;
    cachedHeaders = headers;
    
    console.log(`✅ Dados carregados!`);
    console.log(`📋 Aba: ${ENGINEER_SHEET}`);
    console.log(`📋 Colunas: ${headers.join(', ')}`);
    console.log(`📊 Total de registros: ${data.length}\n`);
    
    // Mostrar amostra
    if (data.length > 0) {
      console.log('📌 Projetos disponíveis:');
      console.log('─'.repeat(80));
      data.slice(0, 5).forEach((row, idx) => {
        const id = row['Nº'] || '???';
        const cliente = row['Cliente'] || '';
        const obra = row['Obra'] || '';
        const status = row['Status do Projeto'] || '';
        console.log(`${idx + 1}. ${id} - ${cliente} - ${obra} [${status}]`);
      });
      console.log('─'.repeat(80));
    }
    
    return true;
  } catch (error) {
    console.error('❌ Erro ao carregar dados:', error.message);
    return false;
  }
}

// Processar comando
async function processCommand(command) {
  try {
    console.log('\n🤖 Interpretando comando...');
    
    // Interpretar comando
    const intent = await CommandService.parseCommand(command, cachedHeaders);
    
    console.log(`📊 Ação: ${intent.action}`);
    console.log(`📊 Confiança: ${intent.confidence}`);
    if (intent.projectId) console.log(`📊 Projeto: ${intent.projectId}`);
    if (intent.fields) console.log(`📊 Campos: ${JSON.stringify(intent.fields, null, 2)}`);
    
    // Validar
    const validation = CommandService.validateCommand(intent);
    if (!validation.valid) {
      console.log('\n❌ Comando inválido:');
      console.log(validation.error);
      return;
    }
    
    // Processar por tipo
    if (intent.action === 'update') {
      await handleUpdate(intent);
    } else if (intent.action === 'add') {
      await handleAdd(intent);
    } else {
      console.log('❌ Ação não suportada neste teste');
    }
    
  } catch (error) {
    console.error('❌ Erro ao processar comando:', error.message);
  }
}

// Atualizar projeto
async function handleUpdate(intent) {
  try {
    // Gerar preview (passando o range correto)
    const preview = await CommandService.generatePreview(
      SPREADSHEET_ID,
      ENGINEER_SHEET,
      intent,
      SHEET_RANGE
    );
    
    if (!preview) {
      console.log(`\n❌ Projeto ${intent.projectId} não encontrado`);
      return;
    }
    
    // Mostrar preview
    console.log('\n╔════════════════════════════════════════════════════╗');
    console.log('║  📝 PREVIEW DAS MUDANÇAS                          ║');
    console.log('╚════════════════════════════════════════════════════╝\n');
    console.log(`🔹 Projeto: ${preview.projectId}`);
    console.log(`🔹 Nome: ${preview.projectName}\n`);
    console.log('Mudanças:');
    
    for (const change of preview.changes) {
      console.log(`  • ${change.field}`);
      console.log(`    De: "${change.oldValue}"`);
      console.log(`    Para: "${change.newValue}"`);
    }
    
    console.log(`\nSerá aplicado em:`);
    for (const sheet of preview.affectedSheets) {
      console.log(`  ✅ Aba ${sheet}`);
    }
    
    // Confirmar
    const confirm = await askConfirmation('\n⚠️  Executar atualização? (s/n): ');
    
    if (!confirm) {
      console.log('✅ Operação cancelada');
      return;
    }
    
    // Executar
    console.log('\n⏳ Executando atualização...\n');
    
    const sheetsService = getGoogleSheetsService();
    
    // Atualizar aba Engenheiro
    const engineerSuccess = await sheetsService.updateRowByID(
      SPREADSHEET_ID,
      ENGINEER_SHEET,
      intent.projectId,
      intent.fields,
      SHEET_RANGE
    );
    
    if (!engineerSuccess) {
      console.log('❌ Erro ao atualizar aba Engenheiro');
      return;
    }
    
    // Sincronizar com Evandro
    const syncResult = await SheetSyncService.syncProjectToEvandro(
      SPREADSHEET_ID,
      intent.projectId,
      ENGINEER_SHEET,
      EVANDRO_SHEET,
      SHEET_RANGE
    );
    
    // Resultado
    console.log('\n╔════════════════════════════════════════════════════╗');
    console.log('║  ✅ RESULTADO                                     ║');
    console.log('╚════════════════════════════════════════════════════╝\n');
    console.log(`✅ Aba ${ENGINEER_SHEET}: Atualizada`);
    
    if (syncResult.success) {
      console.log(`✅ Aba ${EVANDRO_SHEET}: Sincronizada`);
      console.log(`📝 Campos sincronizados: ${syncResult.syncedFields.join(', ')}`);
    } else {
      console.log(`❌ Aba ${EVANDRO_SHEET}: Erro na sincronização`);
      console.log(`Erros: ${syncResult.errors.join(', ')}`);
    }
    
    // Recarregar dados
    await loadData();
    
  } catch (error) {
    console.error('❌ Erro ao executar update:', error.message);
  }
}

// Adicionar projeto
async function handleAdd(intent) {
  try {
    // Gerar próximo ID
    const nextId = await CommandService.generateNextProjectId(
      SPREADSHEET_ID,
      ENGINEER_SHEET,
      SHEET_RANGE
    );
    
    const projectData = { 'Nº': nextId, ...intent.fields };
    
    // Mostrar preview
    console.log('\n╔════════════════════════════════════════════════════╗');
    console.log('║  📝 PREVIEW DO NOVO PROJETO                       ║');
    console.log('╚════════════════════════════════════════════════════╝\n');
    console.log(`🆔 ID: ${nextId}\n`);
    console.log('Dados:');
    
    for (const [field, value] of Object.entries(projectData)) {
      console.log(`  • ${field}: ${value}`);
    }
    
    console.log(`\nSerá criado em:`);
    console.log(`  ✅ Aba ${ENGINEER_SHEET}`);
    console.log(`  ✅ Aba ${EVANDRO_SHEET}`);
    
    // Confirmar
    const confirm = await askConfirmation('\n⚠️  Criar projeto? (s/n): ');
    
    if (!confirm) {
      console.log('✅ Operação cancelada');
      return;
    }
    
    // Executar
    console.log('\n⏳ Criando projeto...\n');
    
    const result = await SheetSyncService.createProjectInBothSheets(
      SPREADSHEET_ID,
      projectData,
      ENGINEER_SHEET,
      EVANDRO_SHEET
    );
    
    // Resultado
    console.log('\n╔════════════════════════════════════════════════════╗');
    console.log('║  ✅ RESULTADO                                     ║');
    console.log('╚════════════════════════════════════════════════════╝\n');
    
    if (result.success) {
      console.log(`✅ Projeto ${result.projectId} criado com sucesso!`);
      console.log(`✅ Aba ${ENGINEER_SHEET}: Criado`);
      console.log(`✅ Aba ${EVANDRO_SHEET}: Criado`);
    } else {
      console.log('❌ Erro ao criar projeto:');
      console.log(result.errors.join('\n'));
    }
    
    // Recarregar dados
    await loadData();
    
  } catch (error) {
    console.error('❌ Erro ao executar add:', error.message);
  }
}

// Helper: perguntar confirmação
function askConfirmation(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.toLowerCase().match(/^(s|sim|y|yes)$/));
    });
  });
}

// Loop de comandos
function askCommand() {
  rl.question('\n💬 Digite um comando (ou "sair"): ', async (input) => {
    const command = input.trim();
    
    if (!command) {
      askCommand();
      return;
    }
    
    if (command.toLowerCase() === 'sair' || command.toLowerCase() === 'exit') {
      console.log('\n👋 Encerrando teste. Até logo!\n');
      rl.close();
      process.exit(0);
      return;
    }
    
    if (command.toLowerCase() === 'reload' || command.toLowerCase() === 'atualizar') {
      await loadData();
      askCommand();
      return;
    }
    
    if (command.toLowerCase() === 'help' || command.toLowerCase() === 'ajuda') {
      console.log('\n📖 Comandos disponíveis:');
      console.log('\n  COMANDOS DE TESTE:');
      console.log('  • "Mude o projeto PRJ-001 para Em Execução"');
      console.log('  • "Adicione projeto: Cliente Alfa, Obra Predial, Área Elétrico"');
      console.log('  • "Atualize o status do PRJ-002 para Parado Cliente"');
      console.log('\n  COMANDOS DO SISTEMA:');
      console.log('  • "reload" ou "atualizar" - Recarrega dados da planilha');
      console.log('  • "sair" ou "exit" - Encerra o teste\n');
      askCommand();
      return;
    }
    
    // Processar comando
    await processCommand(command);
    askCommand();
  });
}

// Iniciar
(async () => {
  const loaded = await loadData();
  
  if (!loaded) {
    console.log('\n❌ Não foi possível carregar a planilha. Verifique as configurações.\n');
    process.exit(1);
  }
  
  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log('║  ✅ PRONTO PARA TESTAR!                           ║');
  console.log('╚════════════════════════════════════════════════════╝');
  console.log('\n📝 Exemplos de comandos:');
  console.log('  • "Mude o projeto 1 para Em Execução"');
  console.log('  • "Mude o status do projeto 2 para Parado Cliente"');
  console.log('  • "Adicione projeto: Cliente X, Obra Y, Área Elétrico"');
  console.log('\n💡 Digite "ajuda" para ver todos os comandos disponíveis');
  
  askCommand();
})();

