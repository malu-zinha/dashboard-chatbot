#!/usr/bin/env ts-node
// =====================================================
// TESTE COMPLETO DO BOT NO TERMINAL
// =====================================================
// Simula o comportamento completo do WhatsApp no terminal
// Execute: npm run test:bot
// =====================================================

import readline from 'readline';
import { messageHandler } from '../../chatbot/handlers/messageHandler.ts';
import { QueryService } from '../../chatbot/handlers/queryService.ts';
import dotenv from 'dotenv';
import { getGoogleSheetsService } from '../../integrations/sheets/googleSheetsService.ts';

// Carregar variáveis de ambiente
dotenv.config();

// Cores para o terminal
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  bgGreen: '\x1b[42m',
  bgBlue: '\x1b[44m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Interface readline
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Usuário de teste
const TEST_USER_ID = '+5511999999999';

// Cache da planilha (simulando o sheetsBot)
let cachedSheetData: any[] = [];
let cachedHeaders: string[] = [];

// =====================================================
// CARREGAR CACHE DA PLANILHA
// =====================================================

async function loadSheetCache() {
  try {
    const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID || '';
    const ENGINEER_SHEET_NAME = process.env.GOOGLE_SHEETS_ENGINEER_SHEET || 'Engenheiro';
    const SHEET_RANGE = process.env.GOOGLE_SHEETS_RANGE || 'A1:Z1000';

    if (!SPREADSHEET_ID) {
      log('⚠️  GOOGLE_SHEETS_ID não configurado - modo consultas desabilitado', 'yellow');
      return;
    }

    const sheetsService = getGoogleSheetsService();
    const fullRange = `${ENGINEER_SHEET_NAME}!${SHEET_RANGE}`;
    
    log('📊 Carregando dados da planilha...', 'yellow');
    const data = await sheetsService.readSheetAsObjects(SPREADSHEET_ID, fullRange);
    const { headers } = await sheetsService.readSheet(SPREADSHEET_ID, fullRange);
    
    cachedSheetData = data;
    cachedHeaders = headers;
    
    log(`✅ Cache carregado: ${data.length} registros\n`, 'green');
  } catch (error: any) {
    log(`⚠️  Erro ao carregar planilha: ${error.message}`, 'yellow');
    log('   Modo consultas desabilitado\n', 'dim');
  }
}

// =====================================================
// PROCESSAR CONSULTA (SIMULANDO O SHEETSBOT)
// =====================================================

async function processQuery(question: string): Promise<string> {
  try {
    if (cachedSheetData.length === 0) {
      return '❌ Não consegui acessar a planilha. Modo consultas desabilitado.';
    }

    const result = await QueryService.querySheet(question, cachedSheetData, cachedHeaders);
    return result.answer;
  } catch (error: any) {
    return `❌ Erro ao processar consulta: ${error.message}`;
  }
}

// =====================================================
// PROCESSAR MENSAGEM (SIMULANDO O SHEETSBOT)
// =====================================================

async function processMessage(message: string): Promise<string> {
  try {
    // Tentar processar via messageHandler primeiro (fluxos conversacionais)
    const handlerResponse = await messageHandler.processarMensagem(TEST_USER_ID, message);
    
    // Se processou (não é "não entendida"), retornar a resposta
    if (handlerResponse.resposta && !handlerResponse.resposta.includes('não entendi')) {
      return handlerResponse.resposta;
    }

    // Fallback: processar como consulta via IA
    log('🤖 Processando como consulta...', 'dim');
    return await processQuery(message);

  } catch (error: any) {
    return `❌ Erro: ${error.message}`;
  }
}

// =====================================================
// INTERFACE DO BOT
// =====================================================

function showHeader() {
  console.clear();
  log('╔════════════════════════════════════════════════════════════╗', 'cyan');
  log('║        🤖 TESTE DO BOT NO TERMINAL - WhatsApp Sim        ║', 'cyan');
  log('╚════════════════════════════════════════════════════════════╝', 'cyan');
  log('', 'reset');
  log('💡 Digite suas mensagens como se fosse no WhatsApp', 'yellow');
  log('   Comandos: menu, projeto, consultar, ajuda', 'dim');
  log('   Para sair: sair, exit, quit\n', 'dim');
  log('─'.repeat(60), 'dim');
  log('', 'reset');
}

// =====================================================
// LOOP PRINCIPAL
// =====================================================

async function startChat() {
  // Enviar mensagem inicial (simula usuário enviando "oi")
  log('💬 Você: oi\n', 'cyan');
  const welcomeMsg = await processMessage('oi');
  log('🤖 Bot:', 'green');
  log(welcomeMsg, 'reset');
  log('\n' + '─'.repeat(60) + '\n', 'dim');

  // Função para processar entrada
  const processInput = async (input: string) => {
    const trimmed = input.trim();

    // Comandos de saída
    if (['sair', 'exit', 'quit', 'q'].includes(trimmed.toLowerCase())) {
      log('\n👋 Até logo!\n', 'cyan');
      rl.close();
      process.exit(0);
      return;
    }

    // Comandos especiais do teste
    if (trimmed.toLowerCase() === 'limpar' || trimmed.toLowerCase() === 'clear') {
      showHeader();
      promptUser();
      return;
    }

    if (trimmed.toLowerCase() === 'status') {
      const sessao = messageHandler.getSessaoAtiva(TEST_USER_ID);
      log('\n📊 Status da Sessão:', 'yellow');
      log(`   Fluxo ativo: ${sessao?.fluxo_ativo || 'nenhum'}`, 'dim');
      log(`   Total de sessões: ${messageHandler.getTotalSessoes()}`, 'dim');
      log(`   Registros no cache: ${cachedSheetData.length}`, 'dim');
      log('', 'reset');
      promptUser();
      return;
    }

    if (trimmed === '') {
      promptUser();
      return;
    }

    // Processar mensagem normalmente
    log(`\n💬 Você: ${trimmed}\n`, 'cyan');
    
    const response = await processMessage(trimmed);
    
    log('🤖 Bot:', 'green');
    log(response, 'reset');
    log('\n' + '─'.repeat(60) + '\n', 'dim');

    promptUser();
  };

  // Função para pedir input
  const promptUser = () => {
    rl.question(colors.cyan + '💬 Você: ' + colors.reset, processInput);
  };

  // Iniciar loop
  promptUser();
}

// =====================================================
// INICIALIZAR
// =====================================================

async function init() {
  showHeader();

  // Verificar variáveis obrigatórias
  const requiredVars = ['GOOGLE_APPLICATION_CREDENTIALS'];
  const missing = requiredVars.filter(v => !process.env[v]);

  if (missing.length > 0) {
    log('⚠️  Variáveis de ambiente obrigatórias faltando:', 'red');
    missing.forEach(v => log(`   - ${v}`, 'red'));
    log('\n💡 Configure no arquivo .env antes de continuar.\n', 'yellow');
    process.exit(1);
  }

  // Carregar cache da planilha (opcional)
  await loadSheetCache();

  // Iniciar chat
  await startChat();
}

// =====================================================
// EVENTOS
// =====================================================

rl.on('close', () => {
  log('\n👋 Até logo!\n', 'cyan');
  process.exit(0);
});

// Capturar Ctrl+C
process.on('SIGINT', () => {
  log('\n\n👋 Até logo!\n', 'cyan');
  process.exit(0);
});

// Iniciar
init().catch(error => {
  log(`\n❌ Erro fatal: ${error.message}\n`, 'red');
  process.exit(1);
});
