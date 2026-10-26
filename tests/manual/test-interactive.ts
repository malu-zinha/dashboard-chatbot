#!/usr/bin/env ts-node
// =====================================================
// TESTE INTERATIVO - Fluxo de Engenheiros
// =====================================================
// Execute: npx ts-node tests/test-interactive.ts
// =====================================================

import readline from 'readline';
import { EngineerProjectFlow } from '../../chatbot/flows/engineerProjectFlow.ts';
import { getEngineerSheetService } from '../../integrations/sheets/engineerSheetService.ts';
import dotenv from 'dotenv';

// Grava no banco do .env (hoje, a producao). So roda de proposito, contra um
// projeto Supabase de teste.
if (process.env.RUN_DB_TESTS !== '1') {
  console.error(
    'Este script GRAVA no banco apontado pelo .env. Para rodar de proposito, contra um ' +
      'projeto Supabase de teste: RUN_DB_TESTS=1 npx tsx tests/manual/' +
      new URL(import.meta.url).pathname.split('/').pop(),
  );
  process.exit(1);
}


// Carregar variáveis de ambiente
dotenv.config();

// Cores para o terminal
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Interface readline
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: colors.cyan + '💬 Você: ' + colors.reset
});

// Estado do teste
let currentFlow: EngineerProjectFlow | null = null;
let testMode = false;

// =====================================================
// MENU PRINCIPAL
// =====================================================

function showMenu() {
  console.clear();
  log('\n╔════════════════════════════════════════════════════════════╗', 'cyan');
  log('║     🧪 TESTE INTERATIVO - FLUXO DE ENGENHEIROS           ║', 'cyan');
  log('╚════════════════════════════════════════════════════════════╝', 'cyan');
  log('\n📋 Escolha uma opção:\n', 'bright');
  log('  1️⃣  Testar Cadastro de Novo Projeto', 'green');
  log('  2️⃣  Testar Atualização de Projeto Existente', 'green');
  log('  3️⃣  Testar Validações (datas, botões, etc)', 'yellow');
  log('  4️⃣  Listar Projetos da Planilha', 'blue');
  log('  5️⃣  Validar Estrutura da Planilha', 'blue');
  log('  6️⃣  Gerar Próximo Código de Projeto', 'blue');
  log('  7️⃣  Modo Livre (conversar com o bot)', 'magenta');
  log('  0️⃣  Sair\n', 'red');
}

// =====================================================
// TESTAR FLUXO COMPLETO
// =====================================================

async function testFlow(mode: 'create' | 'update') {
  log('\n' + '─'.repeat(60), 'cyan');
  log(`🚀 Iniciando teste: ${mode === 'create' ? 'CADASTRO' : 'ATUALIZAÇÃO'}`, 'bright');
  log('─'.repeat(60) + '\n', 'cyan');

  currentFlow = new EngineerProjectFlow('+5511999999999');
  testMode = true;

  const result = await currentFlow.processarMensagem('iniciar');
  log('🤖 Bot:', 'green');
  log(result.mensagem + '\n', 'reset');

  if (result.finalizado) {
    currentFlow = null;
    testMode = false;
    waitForInput();
    return;
  }

  rl.prompt();
}

// =====================================================
// TESTAR VALIDAÇÕES
// =====================================================

async function testValidations() {
  log('\n' + '─'.repeat(60), 'cyan');
  log('🧪 TESTANDO VALIDAÇÕES', 'bright');
  log('─'.repeat(60) + '\n', 'cyan');

  const service = getEngineerSheetService();

  // Testar validações de data
  log('📅 Validações de Data:', 'yellow');
  const dateTests = [
    { input: '05/12/2024', desc: 'Data válida' },
    { input: '32/13/2024', desc: 'Data inválida (dia/mês errados)' },
    { input: '05-12-2024', desc: 'Formato errado (usa hífen)' },
    { input: '5/12/2024', desc: 'Sem zero à esquerda' },
    { input: 'abc', desc: 'Texto aleatório' },
  ];

  dateTests.forEach(test => {
    const valid = service.validateDateFormat(test.input);
    const parsed = valid ? service.parseDate(test.input) : null;
    const status = valid && parsed ? '✅' : '❌';
    log(`  ${status} "${test.input}" - ${test.desc}`, valid && parsed ? 'green' : 'red');
  });

  log('\n📊 Validações de Constantes:', 'yellow');
  const { TIPOS_PROJETO, AREAS_PROJETO, STATUS_PROJETO, ETAPAS_PROJETO } = await import('../../integrations/sheets/engineerSheetService.ts');
  log(`  ✅ Tipos de projeto: ${TIPOS_PROJETO.length} opções`, 'green');
  log(`  ✅ Áreas: ${AREAS_PROJETO.length} opções`, 'green');
  log(`  ✅ Status: ${STATUS_PROJETO.length} opções`, 'green');
  log(`  ✅ Etapas: ${ETAPAS_PROJETO.length} opções`, 'green');

  log('\n✨ Todas as validações testadas!\n', 'bright');
  waitForInput();
}

// =====================================================
// LISTAR PROJETOS
// =====================================================

async function listProjects() {
  log('\n' + '─'.repeat(60), 'cyan');
  log('📋 LISTANDO PROJETOS', 'bright');
  log('─'.repeat(60) + '\n', 'cyan');

  try {
    const service = getEngineerSheetService();

    log('🔍 Buscando todos os projetos da planilha...', 'yellow');
    const projects = await service.listAllProjects();

    if (projects.length === 0) {
      log('\n❌ Nenhum projeto encontrado na planilha.', 'red');
      log('💡 Verifique se:', 'yellow');
      log('   - A planilha está compartilhada', 'yellow');
      log('   - A planilha tem projetos cadastrados', 'yellow');
      log('   - Os projetos têm código (coluna "Código do Projeto")', 'yellow');
    } else {
      log(`\n✅ ${projects.length} projeto(s) encontrado(s):\n`, 'green');
      projects.forEach((proj, index) => {
        log(`${index + 1}. ${proj.codigo} - ${proj.cliente}`, 'bright');
        log(`   Obra: ${proj.obra || 'N/A'}`, 'reset');
        log(`   Tipo: ${proj.tipo} | Área: ${proj.area}`, 'reset');
        log(`   Status: ${proj.status || 'N/A'} | Etapa: ${proj.etapa || 'N/A'}\n`, 'reset');
      });
    }
  } catch (error: any) {
    log(`\n❌ Erro ao listar projetos: ${error.message}`, 'red');
    if (error.message.includes('GOOGLE_SHEETS_ENGINEER_ID')) {
      log('💡 Configure a variável GOOGLE_SHEETS_ENGINEER_ID no .env', 'yellow');
    }
  }

  log('', 'reset');
  waitForInput();
}

// =====================================================
// VALIDAR ESTRUTURA DA PLANILHA
// =====================================================

async function validateSheet() {
  log('\n' + '─'.repeat(60), 'cyan');
  log('🔍 VALIDANDO ESTRUTURA DA PLANILHA', 'bright');
  log('─'.repeat(60) + '\n', 'cyan');

  try {
    const service = getEngineerSheetService();
    log('🔄 Validando...', 'yellow');
    
    const validation = await service.validateSheetStructure();

    if (validation.valid) {
      log('\n✅ Estrutura da planilha está CORRETA!', 'green');
      log('   Todos os headers obrigatórios estão presentes.\n', 'green');
    } else {
      log('\n❌ Estrutura da planilha está INCORRETA!', 'red');
      log('\nErros encontrados:', 'red');
      validation.errors.forEach(err => {
        log(`   • ${err}`, 'red');
      });
      log('\n💡 Verifique a estrutura em: docs/config-nova-planilha.md\n', 'yellow');
    }
  } catch (error: any) {
    log(`\n❌ Erro ao validar: ${error.message}`, 'red');
  }

  waitForInput();
}

// =====================================================
// GERAR PRÓXIMO CÓDIGO
// =====================================================

async function generateNextCode() {
  log('\n' + '─'.repeat(60), 'cyan');
  log('🆔 GERANDO PRÓXIMO CÓDIGO DE PROJETO', 'bright');
  log('─'.repeat(60) + '\n', 'cyan');

  try {
    const service = getEngineerSheetService();
    log('🔄 Analisando códigos existentes...', 'yellow');
    
    const nextCode = await service.generateNextProjectCode();
    log(`\n✅ Próximo código disponível: ${nextCode}`, 'green');
    log(`   Será usado no próximo projeto cadastrado.\n`, 'reset');
  } catch (error: any) {
    log(`\n❌ Erro ao gerar código: ${error.message}`, 'red');
  }

  waitForInput();
}

// =====================================================
// MODO LIVRE
// =====================================================

async function freeMode() {
  log('\n' + '─'.repeat(60), 'cyan');
  log('💬 MODO LIVRE - Conversar com o Bot', 'bright');
  log('─'.repeat(60), 'cyan');
  log('Digite suas mensagens como se fosse o WhatsApp.', 'yellow');
  log('Digite "sair" ou "menu" para voltar ao menu principal.\n', 'yellow');

  currentFlow = new EngineerProjectFlow('+5511999999999');
  testMode = true;

  const result = await currentFlow.processarMensagem('iniciar');
  log('🤖 Bot:', 'green');
  log(result.mensagem + '\n', 'reset');

  rl.prompt();
}

// =====================================================
// PROCESSAR ENTRADA DO USUÁRIO
// =====================================================

async function processUserInput(input: string) {
  const trimmed = input.trim();

  // Comandos especiais
  if (trimmed.toLowerCase() === 'sair' || trimmed.toLowerCase() === 'menu') {
    currentFlow = null;
    testMode = false;
    showMenu();
    waitForInput();
    return;
  }

  // Se está em modo de teste (fluxo ativo)
  if (testMode && currentFlow) {
    try {
      const result = await currentFlow.processarMensagem(trimmed);
      
      log('\n🤖 Bot:', 'green');
      log(result.mensagem + '\n', 'reset');

      if (result.finalizado) {
        log('✨ Fluxo finalizado!', 'bright');
        log('Digite qualquer tecla para voltar ao menu...\n', 'yellow');
        currentFlow = null;
        testMode = false;
        rl.once('line', () => {
          showMenu();
          waitForInput();
        });
        return;
      }

      rl.prompt();
    } catch (error: any) {
      log(`\n❌ Erro: ${error.message}\n`, 'red');
      rl.prompt();
    }
    return;
  }

  // Menu principal
  switch (trimmed) {
    case '1':
      await testFlow('create');
      break;
    case '2':
      await testFlow('update');
      break;
    case '3':
      await testValidations();
      break;
    case '4':
      await listProjects();
      break;
    case '5':
      await validateSheet();
      break;
    case '6':
      await generateNextCode();
      break;
    case '7':
      await freeMode();
      break;
    case '0':
      log('\n👋 Até logo!\n', 'cyan');
      rl.close();
      process.exit(0);
      break;
    default:
      log('\n❌ Opção inválida. Digite um número de 0 a 7.\n', 'red');
      waitForInput();
  }
}

// =====================================================
// AGUARDAR ENTRADA
// =====================================================

function waitForInput() {
  if (testMode) {
    rl.prompt();
  } else {
    rl.question(colors.yellow + '\n🎯 Digite o número da opção: ' + colors.reset, processUserInput);
  }
}

// =====================================================
// INICIALIZAR
// =====================================================

async function init() {
  // Verificar variáveis de ambiente
  const requiredVars = ['GOOGLE_SHEETS_ENGINEER_ID', 'GOOGLE_APPLICATION_CREDENTIALS'];
  const missing = requiredVars.filter(v => !process.env[v]);

  if (missing.length > 0) {
    log('\n⚠️  Variáveis de ambiente faltando:', 'red');
    missing.forEach(v => log(`   - ${v}`, 'red'));
    log('\n💡 Configure no arquivo .env antes de continuar.', 'yellow');
    log('   Veja: docs/config-nova-planilha.md\n', 'yellow');
    process.exit(1);
  }

  showMenu();
  waitForInput();
}

// =====================================================
// EVENTOS
// =====================================================

rl.on('line', (input) => {
  if (!testMode) {
    processUserInput(input);
  } else {
    processUserInput(input);
  }
});

rl.on('close', () => {
  log('\n👋 Até logo!\n', 'cyan');
  process.exit(0);
});

// Iniciar
init();
